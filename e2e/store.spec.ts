import { test, expect } from '@playwright/test';
test('catalog, search, product details and persistent cart', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Дома. В своей форме.' }),
  ).toBeVisible();
  await expect(page.locator('.product-card')).toHaveCount(8);
  await page.getByRole('button', { name: 'Свет', exact: true }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Все товары', exact: true }).click();
  await page.getByRole('searchbox').fill('Чашка');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Подробнее: Чашка Daily' }).click();
  const detail = page.getByRole('dialog');
  await expect(
    detail.getByText('Каменная керамика', { exact: false }),
  ).toBeVisible();
  await detail
    .getByRole('button', { name: 'Добавить в корзину', exact: true })
    .click();
  await detail.getByRole('button', { name: 'Закрыть' }).click();
  await page.reload();
  await page.getByRole('button', { name: 'Корзина, товаров: 1' }).click();
  const cart = page.getByRole('dialog');
  await expect(
    cart.getByRole('heading', { name: 'Чашка Daily', exact: true }),
  ).toBeVisible();
  await cart
    .getByRole('button', { name: 'Увеличить количество Чашка Daily' })
    .click();
  await expect(
    cart.getByRole('heading', { name: 'Ваша корзина (2)' }),
  ).toBeVisible();
  await cart.getByRole('button', { name: 'Удалить Чашка Daily' }).click();
  await expect(cart.getByText('Здесь будет что-то ваше')).toBeVisible();
  expect(errors).toEqual([]);
});
test('customer can place a cash-on-delivery order', async ({ page }) => {
  await page.goto('/');
  await page
    .getByRole('button', { name: 'Добавить Ваза Form в корзину', exact: true })
    .click();
  await page.getByRole('button', { name: 'Корзина, товаров: 1' }).click();
  await page
    .getByRole('button', { name: 'Оформить заказ', exact: true })
    .click();
  const form = page.getByRole('dialog');
  await form
    .getByLabel('Ваше имя', { exact: true })
    .fill('Тестовый покупатель');
  await form
    .getByLabel('Email', { exact: true })
    .fill('browser-test@example.com');
  await form.getByLabel('Телефон', { exact: true }).fill('+79990000000');
  await form
    .getByLabel('Адрес доставки', { exact: true })
    .fill('Тестовый город, улица Тестовая, дом 2');
  await form.getByRole('button', { name: 'Подтвердить заказ' }).click();
  await expect(
    page.getByRole('heading', { name: 'Заказ оформлен!' }),
  ).toBeVisible();
  await expect(page.locator('.receipt code')).toHaveText(/^[a-f0-9-]{36}$/);
  await page.getByRole('button', { name: 'Продолжить покупки' }).click();
  await expect(
    page.getByRole('button', { name: 'Корзина, товаров: 0' }),
  ).toBeVisible();
});
