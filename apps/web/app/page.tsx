'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowRight,
  Check,
  CheckCircle2,
  Leaf,
  Minus,
  Package,
  Plus,
  Search,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from 'lucide-react';

type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  description: string;
  price: number;
  oldPrice: number | null;
  image: string;
  color: string;
  featured: boolean;
  stock: number;
};
type Cart = Record<string, number>;
type Receipt = { id: string; total: number; shipping: number };
const money = (value: number) =>
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value / 100);
const categories = [
  'Все товары',
  'Мебель',
  'Свет',
  'Декор',
  'Текстиль',
  'Посуда',
];
function Modal({
  children,
  onClose,
  title,
  drawer = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = ref.current;
    node?.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      node?.close();
      document.body.style.overflow = previous;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? 'modal drawer' : 'modal'}
      aria-label={title}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-top">
        <h2>{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="Закрыть">
          <X size={22} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export default function Home() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [category, setCategory] = useState('Все товары');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('popular');
  const [cart, setCart] = useState<Cart>({});
  const [hydrated, setHydrated] = useState(false);
  const [panel, setPanel] = useState<'cart' | 'checkout' | null>(null);
  const [selected, setSelected] = useState<Product | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const request = useRef<{ signature: string; id: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await fetch('/api/products');
      if (!response.ok) throw new Error();
      setProducts(await response.json());
    } catch {
      setLoadError(
        'Не удалось загрузить каталог. Проверьте соединение и попробуйте снова.',
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
    try {
      const parsed: unknown = JSON.parse(
        localStorage.getItem('forma-cart') ?? '{}',
      );
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed))
        setCart(
          Object.fromEntries(
            Object.entries(parsed).filter(
              ([, value]) =>
                Number.isInteger(value) &&
                Number(value) > 0 &&
                Number(value) <= 20,
            ),
          ),
        );
    } catch {}
    setHydrated(true);
  }, [load]);
  useEffect(() => {
    if (hydrated) {
      try {
        localStorage.setItem('forma-cart', JSON.stringify(cart));
      } catch {}
    }
  }, [cart, hydrated]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(timer);
  }, [notice]);
  const lines = useMemo(
    () =>
      products
        .filter((p) => cart[p.id])
        .map((p) => ({ ...p, quantity: cart[p.id] })),
    [products, cart],
  );
  const count = Object.values(cart).reduce((a, b) => a + b, 0);
  const subtotal = lines.reduce((sum, p) => sum + p.price * p.quantity, 0);
  const shipping = subtotal >= 1_000_000 ? 0 : 39_000;
  const unavailable =
    Object.keys(cart).some((id) => !products.some((p) => p.id === id)) ||
    lines.some((p) => p.quantity > p.stock);
  const visible = useMemo(
    () =>
      products
        .filter(
          (p) =>
            (category === 'Все товары' || p.category === category) &&
            `${p.name} ${p.category} ${p.description}`
              .toLowerCase()
              .includes(query.toLowerCase().trim()),
        )
        .sort((a, b) =>
          sort === 'low'
            ? a.price - b.price
            : sort === 'high'
              ? b.price - a.price
              : Number(b.featured) - Number(a.featured),
        ),
    [products, category, query, sort],
  );
  function add(product: Product) {
    setCart((previous) => ({
      ...previous,
      [product.id]: Math.min(
        (previous[product.id] ?? 0) + 1,
        product.stock,
        20,
      ),
    }));
    setNotice(`${product.name} — в корзине`);
  }
  function change(id: string, delta: number) {
    setCart((previous) => {
      const next = { ...previous };
      const product = products.find((p) => p.id === id);
      const amount = Math.min(
        (next[id] ?? 0) + delta,
        product?.stock ?? 20,
        20,
      );
      if (amount <= 0) delete next[id];
      else next[id] = amount;
      return next;
    });
  }
  async function checkout(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !lines.length) return;
    setBusy(true);
    setError('');
    const data = new FormData(event.currentTarget);
    const payload = {
      customerName: String(data.get('customerName')),
      email: String(data.get('email')),
      phone: String(data.get('phone')),
      address: String(data.get('address')),
      comment: String(data.get('comment')),
      items: lines.map((p) => ({ productId: p.id, quantity: p.quantity })),
    };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature)
      request.current = { signature, id: crypto.randomUUID() };
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, requestId: request.current!.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) void load();
        throw new Error(
          Array.isArray(result.message)
            ? 'Проверьте заполненные поля.'
            : (result.message ?? 'Не удалось оформить заказ'),
        );
      }
      setReceipt(result);
      setCart({});
      setPanel(null);
      request.current = null;
      void load();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Проверьте соединение и попробуйте снова',
      );
    } finally {
      setBusy(false);
    }
  }
  const catalog = () =>
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth' });
  return (
    <>
      <div className="announcement">
        Маленькие перемены. Большое ощущение дома.{' '}
        <span>
          Бесплатная доставка от 10 000 ₽ <ArrowRight size={13} />
        </span>
      </div>
      <header>
        <a className="wordmark" href="/" aria-label="FORMA — главная">
          forma<span>®</span>
        </a>
        <nav aria-label="Основная навигация">
          <a href="#catalog">Каталог</a>
          <a href="#about">Наш подход</a>
          <a href="#delivery">Доставка</a>
        </nav>
        <div className="header-actions">
          <button
            className="icon-button"
            aria-label="Поиск товаров"
            onClick={() => {
              catalog();
              searchRef.current?.focus();
            }}
          >
            <Search size={21} />
          </button>
          <button
            className="cart-trigger"
            onClick={() => {
              setError('');
              setPanel('cart');
            }}
            aria-label={`Корзина, товаров: ${count}`}
          >
            <ShoppingBag size={20} />
            <span>Корзина</span>
            <b>{count}</b>
          </button>
        </div>
      </header>
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow">
              <span /> ПРОСТРАНСТВО ДЛЯ ВАШЕЙ ЖИЗНИ
            </div>
            <h1>
              Дома.
              <br />В своей <em>форме.</em>
            </h1>
            <p>
              Вещи, с которыми хочется жить.
              <br />
              Простые, красивые и продуманные до мелочей.
            </p>
            <button className="button dark" onClick={catalog}>
              Найти своё <ArrowRight size={18} />
            </button>
            <div className="hero-bottom">
              <span className="tiny-line" /> НОВЫЙ ВЗГЛЯД НА ПРИВЫЧНЫЕ ВЕЩИ
            </div>
          </div>
          <div className="hero-art">
            <div className="sun-glow" />
            <div className="wall-line" />
            <div className="room-floor" />
            <div className="room-vase">
              <i />
              <i />
              <i />
            </div>
            <div className="room-chair">
              <div className="chair-back" />
              <div className="chair-arm left" />
              <div className="chair-arm right" />
              <div className="chair-seat" />
              <div className="chair-leg one" />
              <div className="chair-leg two" />
            </div>
            <div className="room-table">
              <div />
              <i />
              <b />
            </div>
            <div className="hero-label">
              <span>
                Меньше лишнего.
                <br />
                <b>Больше вашего.</b>
              </span>
              <ArrowDown size={20} />
            </div>
            <div className="collection-tag">
              КОЛЛЕКЦИЯ ДЛЯ ДОМА <span>01 / 08</span>
            </div>
          </div>
        </section>
        <section className="benefits" aria-label="Преимущества">
          <div>
            <Truck />
            <span>
              Бережная доставка<small>До двери вашего дома</small>
            </span>
          </div>
          <div>
            <Leaf />
            <span>
              Честные материалы<small>Приятные на ощупь и в жизни</small>
            </span>
          </div>
          <div>
            <ShieldCheck />
            <span>
              Продуманный выбор<small>Каждая вещь со своим характером</small>
            </span>
          </div>
        </section>
        <section className="catalog section" id="catalog">
          <div className="section-heading">
            <div>
              <div className="eyebrow">ОКРУЖАЙТЕ СЕБЯ ЛЮБИМЫМ</div>
              <h2>
                Для вашего дома<span>.</span>
              </h2>
            </div>
            <span className="item-count">
              {products.length} вещей с характером
            </span>
          </div>
          <div className="catalog-tools">
            <div className="tabs" role="group" aria-label="Категории">
              {categories.map((c) => (
                <button
                  key={c}
                  aria-pressed={c === category}
                  className={category === c ? 'active' : ''}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="filters">
              <label className="search">
                <Search size={16} />
                <input
                  ref={searchRef}
                  type="search"
                  placeholder="Найти вещь"
                  aria-label="Поиск по каталогу"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </label>
              <select
                aria-label="Сортировка"
                value={sort}
                onChange={(e) => setSort(e.target.value)}
              >
                <option value="popular">По популярности</option>
                <option value="low">Сначала дешевле</option>
                <option value="high">Сначала дороже</option>
              </select>
            </div>
          </div>
          {loading ? (
            <div className="product-grid" aria-label="Загрузка каталога">
              {[1, 2, 3, 4].map((n) => (
                <div className="skeleton" key={n} />
              ))}
            </div>
          ) : loadError ? (
            <div className="empty-state" role="alert">
              <Package size={36} />
              <p>{loadError}</p>
              <button className="button dark" onClick={load}>
                Попробовать снова
              </button>
            </div>
          ) : !visible.length ? (
            <div className="empty-state">
              <Search size={32} />
              <h3>Пока ничего не нашлось</h3>
              <p>Попробуйте другой запрос или категорию.</p>
              <button
                className="button outline"
                onClick={() => {
                  setCategory('Все товары');
                  setQuery('');
                }}
              >
                Сбросить фильтры
              </button>
            </div>
          ) : (
            <div className="product-grid">
              {visible.map((p) => (
                <article className="product-card" key={p.id}>
                  <button
                    className="product-image"
                    style={{ background: p.color }}
                    onClick={() => setSelected(p)}
                    aria-label={`Подробнее: ${p.name}`}
                  >
                    <img src={p.image} alt={p.name} width={400} height={400} />
                    {p.oldPrice ? (
                      <span className="badge sale">
                        −{Math.round((1 - p.price / p.oldPrice) * 100)}%
                      </span>
                    ) : p.featured ? (
                      <span className="badge">НАШ ВЫБОР</span>
                    ) : null}
                    <span className="quick-view">
                      Рассмотреть <ArrowRight size={16} />
                    </span>
                  </button>
                  <div className="product-info">
                    <div>
                      <span className="product-category">{p.category}</span>
                      <button
                        className="product-name"
                        onClick={() => setSelected(p)}
                      >
                        {p.name}
                      </button>
                      <div className="price">
                        {money(p.price)}{' '}
                        {p.oldPrice && <del>{money(p.oldPrice)}</del>}
                      </div>
                    </div>
                    <button
                      className="add-button"
                      onClick={() => add(p)}
                      disabled={
                        !p.stock || (cart[p.id] ?? 0) >= Math.min(p.stock, 20)
                      }
                      aria-label={`Добавить ${p.name} в корзину`}
                    >
                      {(cart[p.id] ?? 0) > 0 ? (
                        <Check size={19} />
                      ) : (
                        <Plus size={19} />
                      )}
                    </button>
                  </div>
                  {!p.stock && <small>Нет в наличии</small>}
                </article>
              ))}
            </div>
          )}
          <div className="catalog-end">
            <span>Хорошие вещи остаются надолго.</span>
            <span>
              Выбирайте то, что близко вам <ArrowRight size={15} />
            </span>
          </div>
        </section>
        <section className="about section" id="about">
          <div className="about-symbol">
            f<span>®</span>
          </div>
          <div>
            <div className="eyebrow">ФИЛОСОФИЯ FORMA</div>
            <h2>
              Не просто интерьер.
              <br />
              Ваше <em>место силы.</em>
            </h2>
            <p>
              Мы верим, что дом складывается из деталей. Из света, который
              согревает вечером. Из любимой чашки. Из кресла, в котором можно
              быть собой.
            </p>
            <p>
              Поэтому в forma только вещи, в которых есть смысл, качество и
              немного тихой радости.
            </p>
          </div>
        </section>
        <section className="delivery section" id="delivery">
          <div>
            <div className="eyebrow">ОТ НАС — К ВАМ</div>
            <h2>С заботой на каждом шаге.</h2>
          </div>
          <div className="delivery-grid">
            <div>
              <span>01</span>
              <h3>Выберите своё</h3>
              <p>
                Добавьте понравившиеся вещи в корзину. Все цены указаны в
                рублях.
              </p>
            </div>
            <div>
              <span>02</span>
              <h3>Оформите заказ</h3>
              <p>
                Оставьте адрес и контакты. Оплата при получении, без ввода
                банковских данных.
              </p>
            </div>
            <div>
              <span>03</span>
              <h3>Ждите дома</h3>
              <p>
                Доставка — 390 ₽, от 10 000 ₽ бесплатно. Срок и возможность
                доставки подтвердим после оформления.
              </p>
            </div>
          </div>
        </section>
      </main>
      <footer>
        <div className="footer-top">
          <a className="wordmark" href="/">
            forma<span>®</span>
          </a>
          <span>Вещи для жизни. Место для себя.</span>
          <a href="#catalog">
            Вернуться к каталогу <ArrowRight size={16} />
          </a>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} FORMA</span>
          <span>Учебный магазин · Оплата при получении</span>
          <span>Создано с вниманием к деталям</span>
        </div>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {selected && (
        <Modal title={selected.name} onClose={() => setSelected(null)}>
          <div className="detail">
            <div
              className="detail-image"
              style={{ background: selected.color }}
            >
              <img src={selected.image} alt={selected.name} />
            </div>
            <span className="eyebrow">{selected.category}</span>
            <p>{selected.description}</p>
            <div className="detail-price">
              {money(selected.price)}{' '}
              {selected.oldPrice && <del>{money(selected.oldPrice)}</del>}
            </div>
            <p className="muted">
              В наличии: {selected.stock} шт. · Доставка от 390 ₽
            </p>
            <button
              className="button dark full"
              disabled={
                !selected.stock ||
                (cart[selected.id] ?? 0) >= Math.min(selected.stock, 20)
              }
              onClick={() => add(selected)}
            >
              <ShoppingBag size={18} />
              {!selected.stock ? 'Нет в наличии' : 'Добавить в корзину'}
            </button>
          </div>
        </Modal>
      )}
      {panel && (
        <Modal
          title={
            panel === 'cart' ? `Ваша корзина (${count})` : 'Оформление заказа'
          }
          drawer
          onClose={() => {
            if (!busy) setPanel(null);
          }}
        >
          {panel === 'cart' ? (
            <>
              {!count ? (
                <div className="empty-state">
                  <ShoppingBag size={40} />
                  <h3>Здесь будет что-то ваше</h3>
                  <p>Выберите первую вещь для дома.</p>
                  <button
                    className="button dark"
                    onClick={() => {
                      setPanel(null);
                      catalog();
                    }}
                  >
                    Открыть каталог <ArrowRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <div className="cart-lines">
                    {lines.map((p) => (
                      <div className="cart-line" key={p.id}>
                        <img
                          src={p.image}
                          alt={p.name}
                          style={{ background: p.color }}
                        />
                        <div className="cart-line-content">
                          <h3>{p.name}</h3>
                          <span>{money(p.price)}</span>
                          <div className="quantity">
                            <button
                              onClick={() => change(p.id, -1)}
                              aria-label={`Уменьшить количество ${p.name}`}
                            >
                              <Minus size={14} />
                            </button>
                            <span>{p.quantity}</span>
                            <button
                              disabled={p.quantity >= Math.min(p.stock, 20)}
                              onClick={() => change(p.id, 1)}
                              aria-label={`Увеличить количество ${p.name}`}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                          {p.quantity > p.stock && (
                            <small className="error">
                              Доступно только {p.stock} шт.
                            </small>
                          )}
                        </div>
                        <button
                          className="icon-button"
                          aria-label={`Удалить ${p.name}`}
                          onClick={() =>
                            setCart((previous) => {
                              const next = { ...previous };
                              delete next[p.id];
                              return next;
                            })
                          }
                        >
                          <X size={17} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {unavailable && (
                    <div className="error" role="alert">
                      Некоторые товары недоступны. Уменьшите количество или
                      очистите корзину.
                      <button
                        className="text-button"
                        onClick={() => setCart({})}
                      >
                        Очистить корзину
                      </button>
                    </div>
                  )}
                  <div className="cart-summary">
                    <p>
                      <span>Товары</span>
                      <b>{money(subtotal)}</b>
                    </p>
                    <p>
                      <span>Доставка</span>
                      <b>{shipping ? money(shipping) : 'Бесплатно'}</b>
                    </p>
                    {shipping > 0 && (
                      <small>
                        До бесплатной доставки {money(1_000_000 - subtotal)}
                      </small>
                    )}
                    <p className="total">
                      <span>Итого</span>
                      <b>{money(subtotal + shipping)}</b>
                    </p>
                    <button
                      className="button dark full"
                      disabled={unavailable || !lines.length || loading}
                      onClick={() => {
                        setError('');
                        setPanel('checkout');
                      }}
                    >
                      Оформить заказ <ArrowRight size={18} />
                    </button>
                    <p className="muted">Оплата при получении</p>
                  </div>
                </>
              )}
            </>
          ) : (
            <form className="checkout-form" onSubmit={checkout}>
              <button
                type="button"
                className="text-button"
                disabled={busy}
                onClick={() => setPanel('cart')}
              >
                ← Вернуться в корзину
              </button>
              <fieldset disabled={busy}>
                <legend>Контактные данные</legend>
                <label>
                  Ваше имя
                  <input
                    name="customerName"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={100}
                    placeholder="Как к вам обращаться"
                  />
                </label>
                <label>
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="you@example.com"
                  />
                </label>
                <label>
                  Телефон
                  <input
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    required
                    minLength={7}
                    maxLength={25}
                    placeholder="+7 999 123-45-67"
                  />
                </label>
                <label>
                  Адрес доставки
                  <textarea
                    name="address"
                    autoComplete="street-address"
                    required
                    minLength={10}
                    maxLength={500}
                    placeholder="Город, улица, дом, квартира, индекс"
                    rows={3}
                  />
                </label>
                <label>
                  Комментарий <span className="muted">(необязательно)</span>
                  <textarea
                    name="comment"
                    maxLength={1000}
                    rows={2}
                    placeholder="Например, код домофона"
                  />
                </label>
              </fieldset>
              <div className="cart-summary">
                <p className="total">
                  <span>К оплате при получении</span>
                  <b>{money(subtotal + shipping)}</b>
                </p>
                <p className="muted">
                  Контактные данные используются для обработки и доставки вашего
                  заказа.
                </p>
                {error && (
                  <p className="error" role="alert">
                    {error}
                  </p>
                )}
                <button
                  className="button dark full"
                  disabled={busy || unavailable || !lines.length}
                  type="submit"
                >
                  {busy ? 'Оформляем…' : 'Подтвердить заказ'}
                  <Check size={18} />
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
      {receipt && (
        <Modal title="Спасибо за ваш выбор" onClose={() => setReceipt(null)}>
          <div className="success">
            <div className="success-icon">
              <Check size={32} />
            </div>
            <h3>Заказ оформлен!</h3>
            <p>
              Мы получили заказ и свяжемся с вами, чтобы подтвердить детали
              доставки.
            </p>
            <div className="receipt">
              <span>Номер заказа</span>
              <code>{receipt.id}</code>
              <span>Оплата при получении</span>
              <strong>{money(receipt.total)}</strong>
            </div>
            <button
              className="button dark full"
              onClick={() => setReceipt(null)}
            >
              Продолжить покупки <ArrowRight size={18} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
