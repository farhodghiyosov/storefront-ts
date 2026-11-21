import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const allowed =
    request.method === 'GET'
      ? path[0] === 'products' && path.length <= 2
      : request.method === 'POST' && path.join('/') === 'orders';
  if (!allowed)
    return NextResponse.json({ message: 'Not found' }, { status: 404 });
  try {
    let body: string | undefined;
    if (request.method === 'POST') {
      // Read a bounded stream, including requests without Content-Length.
      const reader = request.body?.getReader();
      const chunks: Uint8Array[] = [];
      let length = 0;
      if (reader)
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.byteLength;
          if (length > 32_768) {
            await reader.cancel();
            return NextResponse.json(
              { message: 'Запрос слишком большой' },
              { status: 413 },
            );
          }
          chunks.push(part.value);
        }
      body = Buffer.concat(chunks).toString('utf8');
    }
    const response = await fetch(
      `${process.env.API_INTERNAL_URL ?? 'http://localhost:4000'}/api/${path.map(encodeURIComponent).join('/')}`,
      {
        method: request.method,
        headers: { 'Content-Type': 'application/json' },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(15_000),
      },
    );
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { message: 'Магазин временно недоступен. Попробуйте ещё раз.' },
      { status: 503 },
    );
  }
}
export { proxy as GET, proxy as POST };
