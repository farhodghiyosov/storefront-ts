import { createHash } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateOrderDto } from './order.dto';
import { calculateTotals } from './checkout';
import { Prisma } from './generated/prisma/client';
@Injectable()
export class ShopService {
  constructor(private readonly db: PrismaService) {}
  products() {
    return this.db.product.findMany({
      orderBy: [{ featured: 'desc' }, { createdAt: 'asc' }],
    });
  }
  async product(slug: string) {
    const product = await this.db.product.findUnique({ where: { slug } });
    if (!product) throw new NotFoundException('Товар не найден');
    return product;
  }
  async createOrder(dto: CreateOrderDto) {
    const quantities = new Map<string, number>();
    for (const item of dto.items)
      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity,
      );
    if ([...quantities.values()].some((q) => q > 20))
      throw new BadRequestException('Не более 20 единиц одного товара');
    const requestHash = createHash('sha256')
      .update(
        JSON.stringify({
          customerName: dto.customerName.trim(),
          email: dto.email,
          phone: dto.phone,
          address: dto.address.trim(),
          comment: dto.comment ?? '',
          items: [...quantities.entries()].sort(([a], [b]) =>
            a.localeCompare(b),
          ),
        }),
      )
      .digest('hex');
    // Only a receipt is returned, never customer contact data.
    const select = {
      id: true,
      total: true,
      subtotal: true,
      shipping: true,
      status: true,
    } as const;
    const findExisting = async () => {
      const existing = await this.db.order.findUnique({
        where: { requestId: dto.requestId },
        select: { ...select, requestHash: true },
      });
      if (!existing) return null;
      if (existing.requestHash !== requestHash)
        throw new ConflictException(
          'Идентификатор уже использован для другого заказа',
        );
      const { requestHash: _, ...receipt } = existing;
      return receipt;
    };
    const existing = await findExisting();
    if (existing) return existing;
    try {
      return await this.db.$transaction(async (tx) => {
        const products = await tx.product.findMany({
          where: { id: { in: [...quantities.keys()] } },
          orderBy: { id: 'asc' },
        });
        if (products.length !== quantities.size)
          throw new ConflictException('Некоторые товары больше недоступны');
        const items = products.map((p) => ({
          productId: p.id,
          name: p.name,
          price: p.price,
          quantity: quantities.get(p.id)!,
        }));
        for (const item of items) {
          const changed = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
          if (changed.count !== 1)
            throw new ConflictException(`Недостаточно товара: ${item.name}`);
        }
        return tx.order.create({
          data: {
            requestId: dto.requestId,
            requestHash,
            customerName: dto.customerName.trim(),
            email: dto.email,
            phone: dto.phone,
            address: dto.address.trim(),
            comment: dto.comment,
            ...calculateTotals(items),
            items: { create: items },
          },
          select,
        });
      });
    } catch (error) {
      if (
        error instanceof ConflictException ||
        (error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002')
      ) {
        const order = await findExisting();
        if (order) return order;
      }
      throw error;
    }
  }
}
