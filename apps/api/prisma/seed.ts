import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const products = [
  {
    slug: 'arc-lamp',
    name: 'Настольная лампа Arc',
    category: 'Свет',
    description:
      'Скульптурная лампа с мягким тёплым светом. Металлический корпус, матовое покрытие и удобный выключатель на шнуре. Лампа E27 в комплекте.',
    price: 649000,
    oldPrice: 749000,
    image: '/products/arc-lamp.svg',
    color: '#eee5d8',
    featured: true,
    stock: 25,
  },
  {
    slug: 'cloud-chair',
    name: 'Кресло Cloud',
    category: 'Мебель',
    description:
      'Мягкое кресло из букле для неспешных утренних ритуалов. Каркас из массива дерева, съёмная подушка и тактильная ткань.',
    price: 2499000,
    oldPrice: null,
    image: '/products/cloud-chair.svg',
    color: '#e4e5df',
    featured: true,
    stock: 25,
  },
  {
    slug: 'form-vase',
    name: 'Ваза Form',
    category: 'Декор',
    description:
      'Керамическая ваза с органичным силуэтом. Сделана вручную: лёгкие различия формы делают каждый экземпляр особенным.',
    price: 289000,
    oldPrice: null,
    image: '/products/form-vase.svg',
    color: '#e9ddd1',
    featured: true,
    stock: 25,
  },
  {
    slug: 'linen-throw',
    name: 'Льняной плед',
    category: 'Текстиль',
    description:
      'Лёгкий фактурный плед из натурального льна и хлопка. Размер 140 × 200 см. Деликатная стирка при 30 °C.',
    price: 459000,
    oldPrice: 529000,
    image: '/products/linen-throw.svg',
    color: '#e5e7dc',
    featured: false,
    stock: 25,
  },
  {
    slug: 'orbit-clock',
    name: 'Часы Orbit',
    category: 'Декор',
    description:
      'Настенные часы с бесшумным механизмом. Натуральный дуб, лаконичный циферблат. Диаметр 30 см. Батарейка AA в комплект не входит.',
    price: 379000,
    oldPrice: null,
    image: '/products/orbit-clock.svg',
    color: '#ece7df',
    featured: false,
    stock: 25,
  },
  {
    slug: 'daily-cup',
    name: 'Чашка Daily',
    category: 'Посуда',
    description:
      'Любимая чашка на каждый день. Каменная керамика, шелковистая глазурь, объём 300 мл. Подходит для посудомоечной машины.',
    price: 129000,
    oldPrice: null,
    image: '/products/daily-cup.svg',
    color: '#e3e6e0',
    featured: false,
    stock: 25,
  },
  {
    slug: 'oak-table',
    name: 'Столик Oak',
    category: 'Мебель',
    description:
      'Компактный журнальный столик из дубового шпона. Высота 45 см, диаметр 50 см. Простая сборка без специальных инструментов.',
    price: 1199000,
    oldPrice: null,
    image: '/products/oak-table.svg',
    color: '#e8e0d5',
    featured: false,
    stock: 25,
  },
  {
    slug: 'soft-cushion',
    name: 'Подушка Soft',
    category: 'Текстиль',
    description:
      'Декоративная подушка из плотного хлопка. Размер 45 × 45 см. Съёмный чехол на потайной молнии, наполнитель в комплекте.',
    price: 219000,
    oldPrice: null,
    image: '/products/soft-cushion.svg',
    color: '#e4dbd0',
    featured: false,
    stock: 25,
  },
];
async function main() {
  for (const product of products) {
    const { stock, ...details } = product;
    await db.product.upsert({
      where: { slug: product.slug },
      create: product,
      update: details,
    });
  }
  console.log(
    'Каталог заполнен: 8 товаров. Остатки существующих товаров сохранены.',
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
