import { Body, Controller, Get, Module, Param, Post } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, Throttle } from '@nestjs/throttler';
import { PrismaService } from './prisma.service';
import { ShopService } from './shop.service';
import { CreateOrderDto } from './order.dto';
@Controller()
class ShopController {
  constructor(
    private readonly shop: ShopService,
    private readonly db: PrismaService,
  ) {}
  @Get('health') async health() {
    await this.db.$queryRaw`SELECT 1`;
    return { status: 'ok' };
  }
  @Get('products') products() {
    return this.shop.products();
  }
  @Get('products/:slug') product(@Param('slug') slug: string) {
    return this.shop.product(slug);
  }
  @Post('orders')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  order(@Body() body: CreateOrderDto) {
    return this.shop.createOrder(body);
  }
}
@Module({
  imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 200 }])],
  controllers: [ShopController],
  providers: [
    PrismaService,
    ShopService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
