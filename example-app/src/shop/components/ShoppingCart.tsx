import React, { useState } from 'react';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image: string;
  maxQuantity: number;
}

export const ShoppingCart: React.FC = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([
    {
      id: '1',
      name: 'Premium Wireless Headphones',
      price: 199.99,
      quantity: 1,
      image: '/images/headphones.jpg',
      maxQuantity: 5
    },
    {
      id: '2',
      name: 'Organic Cotton T-Shirt',
      price: 29.99,
      quantity: 2,
      image: '/images/tshirt.jpg',
      maxQuantity: 10
    }
  ]);

  const [promoCode, setPromoCode] = useState('');
  const [discount, setDiscount] = useState(0);
  const [isCheckingPromo, setIsCheckingPromo] = useState(false);

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity === 0) {
      removeItem(itemId);
      return;
    }

    setCartItems(items => 
      items.map(item => 
        item.id === itemId 
          ? { ...item, quantity: Math.min(newQuantity, item.maxQuantity) }
          : item
      )
    );
  };

  const removeItem = (itemId: string) => {
    setCartItems(items => items.filter(item => item.id !== itemId));
  };

  const applyPromoCode = async () => {
    if (!promoCode.trim()) return;

    setIsCheckingPromo(true);
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Mock promo code validation
    if (promoCode.toLowerCase() === 'save10') {
      setDiscount(0.1); // 10% discount
      alert(t('shop.cart.promoApplied'));
    } else {
      alert(t('shop.cart.promoInvalid'));
    }
    
    setIsCheckingPromo(false);
  };

  const subtotal = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const discountAmount = subtotal * discount;
  const tax = (subtotal - discountAmount) * 0.08; // 8% tax
  const shipping = subtotal > 50 ? 0 : 9.99;
  const total = subtotal - discountAmount + tax + shipping;

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(price);
  };

  if (cartItems.length === 0) {
    return (
      <div className="shopping-cart empty-cart">
        <div className="empty-cart-icon">🛒</div>
        <h2>{t('shop.cart.empty.title')}</h2>
        <p>{t('shop.cart.empty.message')}</p>
        <button className="btn-primary">
          {t('shop.cart.empty.continueShopping')}
        </button>
      </div>
    );
  }

  return (
    <div className="shopping-cart">
      <div className="cart-header">
        <h1>{t('shop.cart.title')}</h1>
        <p>{t('shop.cart.itemCount', { count: cartItems.length })}</p>
      </div>

      <div className="cart-content">
        <div className="cart-items">
          {cartItems.map(item => (
            <div key={item.id} className="cart-item">
              <div className="item-image">
                <img src={item.image} alt={item.name} />
              </div>

              <div className="item-details">
                <h3>{item.name}</h3>
                <p className="item-price">{formatPrice(item.price)}</p>
              </div>

              <div className="item-quantity">
                <label>{t('shop.cart.quantity')}</label>
                <div className="quantity-controls">
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    disabled={item.quantity <= 1}
                    aria-label={t('shop.cart.decreaseQuantity')}
                  >
                    −
                  </button>
                  <span className="quantity-value">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.maxQuantity}
                    aria-label={t('shop.cart.increaseQuantity')}
                  >
                    +
                  </button>
                </div>
                {item.quantity >= item.maxQuantity && (
                  <p className="max-quantity-warning">
                    {t('shop.cart.maxQuantityReached')}
                  </p>
                )}
              </div>

              <div className="item-total">
                <p>{formatPrice(item.price * item.quantity)}</p>
              </div>

              <div className="item-actions">
                <button 
                  className="remove-button"
                  onClick={() => removeItem(item.id)}
                  aria-label={t('shop.cart.removeItem', { item: item.name })}
                >
                  {t('shop.cart.remove')}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="cart-summary">
          <div className="promo-code">
            <h3>{t('shop.cart.promoCode')}</h3>
            <div className="promo-input">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder={t('shop.cart.enterPromoCode')}
                disabled={isCheckingPromo}
              />
              <button 
                onClick={applyPromoCode}
                disabled={isCheckingPromo || !promoCode.trim()}
              >
                {isCheckingPromo ? t('shop.cart.applying') : t('shop.cart.apply')}
              </button>
            </div>
          </div>

          <div className="order-summary">
            <h3>{t('shop.cart.orderSummary')}</h3>
            
            <div className="summary-line">
              <span>{t('shop.cart.subtotal')}</span>
              <span>{formatPrice(subtotal)}</span>
            </div>

            {discount > 0 && (
              <div className="summary-line discount">
                <span>{t('shop.cart.discount')}</span>
                <span>-{formatPrice(discountAmount)}</span>
              </div>
            )}

            <div className="summary-line">
              <span>{t('shop.cart.tax')}</span>
              <span>{formatPrice(tax)}</span>
            </div>

            <div className="summary-line">
              <span>{t('shop.cart.shipping')}</span>
              <span>{shipping === 0 ? t('shop.cart.freeShipping') : formatPrice(shipping)}</span>
            </div>

            {shipping > 0 && (
              <p className="free-shipping-notice">
                {t('shop.cart.freeShippingThreshold', { amount: formatPrice(50) })}
              </p>
            )}

            <div className="summary-line total">
              <span>{t('shop.cart.total')}</span>
              <span>{formatPrice(total)}</span>
            </div>
          </div>

          <div className="checkout-actions">
            <button className="btn-primary btn-full">
              {t('shop.cart.proceedToCheckout')}
            </button>
            
            <button className="btn-secondary btn-full">
              {t('shop.cart.continueShopping')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

