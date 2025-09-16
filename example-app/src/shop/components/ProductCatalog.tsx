import type React from "react"
import { useState } from "react"

interface Product {
  id: string
  name: string
  description: string
  price: number
  originalPrice?: number
  category: string
  image: string
  rating: number
  reviewCount: number
  inStock: boolean
  isOnSale: boolean
}

export const ProductCatalog: React.FC = () => {
  const [products] = useState<Product[]>([
    {
      id: "1",
      name: "Premium Wireless Headphones",
      description: "High-quality wireless headphones with noise cancellation",
      price: 199.99,
      originalPrice: 249.99,
      category: "electronics",
      image: "/images/headphones.jpg",
      rating: 4.5,
      reviewCount: 128,
      inStock: true,
      isOnSale: true,
    },
    {
      id: "2",
      name: "Organic Cotton T-Shirt",
      description: "Comfortable organic cotton t-shirt in various colors",
      price: 29.99,
      category: "clothing",
      image: "/images/tshirt.jpg",
      rating: 4.2,
      reviewCount: 89,
      inStock: true,
      isOnSale: false,
    },
    {
      id: "3",
      name: "Smart Fitness Watch",
      description: "Track your fitness goals with this advanced smartwatch",
      price: 299.99,
      category: "electronics",
      image: "/images/watch.jpg",
      rating: 4.7,
      reviewCount: 256,
      inStock: false,
      isOnSale: false,
    },
  ])

  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [sortBy, setSortBy] = useState<string>("name")

  const categories = [
    { value: "all", label: t("shop.catalog.categories.all") },
    { value: "electronics", label: t("shop.catalog.categories.electronics") },
    { value: "clothing", label: t("shop.catalog.categories.clothing") },
    { value: "home", label: t("shop.catalog.categories.home") },
  ]

  const sortOptions = [
    { value: "name", label: t("shop.catalog.sort.name") },
    { value: "price-low", label: t("shop.catalog.sort.priceLowToHigh") },
    { value: "price-high", label: t("shop.catalog.sort.priceHighToLow") },
    { value: "rating", label: t("shop.catalog.sort.rating") },
  ]

  const filteredProducts = products.filter(
    (product) =>
      selectedCategory === "all" || product.category === selectedCategory,
  )

  const handleAddToCart = (productId: string) => {
    console.log(`Adding product ${productId} to cart`)
    // Show success message
    alert(t("shop.catalog.addedToCart"))
  }

  const handleQuickView = (productId: string) => {
    console.log(`Quick view for product ${productId}`)
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price)
  }

  return (
    <div className="shop-catalog">
      <div className="catalog-header">
        <h1>{t("catalogTitle")}</h1>
        <p>{t("catalogSubtitle", { count: filteredProducts.length })}</p>
      </div>

      <div className="catalog-filters">
        <div className="filter-group">
          <label>{t("shop.catalog.filterByCategory")}</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            {categories.map((category) => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>{t("shop.catalog.sortBy")}</label>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="products-grid">
        {filteredProducts.map((product) => (
          <div key={product.id} className="product-card">
            {product.isOnSale && (
              <div className="sale-badge">{t("shop.catalog.sale")}</div>
            )}

            <div className="product-image">
              <img src={product.image} alt={product.name} />
              {!product.inStock && (
                <div className="out-of-stock-overlay">
                  {t("shop.catalog.outOfStock")}
                </div>
              )}
            </div>

            <div className="product-info">
              <h3 className="product-name">{product.name}</h3>
              <p className="product-description">{product.description}</p>

              <div className="product-rating">
                <span className="stars">
                  {"★".repeat(Math.floor(product.rating))}
                </span>
                <span className="rating-text">
                  {product.rating} (
                  {t("shop.catalog.reviews", { count: product.reviewCount })})
                </span>
              </div>

              <div className="product-pricing">
                <span className="current-price">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="original-price">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
                {product.isOnSale && (
                  <span className="discount">
                    {t("shop.catalog.saveAmount", {
                      amount: formatPrice(
                        (product.originalPrice || 0) - product.price,
                      ),
                    })}
                  </span>
                )}
              </div>

              <div className="product-actions">
                <button
                  className="btn-primary"
                  onClick={() => handleAddToCart(product.id)}
                  disabled={!product.inStock}
                >
                  {product.inStock
                    ? t("shop.catalog.addToCart")
                    : t("shop.catalog.outOfStock")}
                </button>

                <button
                  className="btn-secondary"
                  onClick={() => handleQuickView(product.id)}
                >
                  {t("shop.catalog.quickView")}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="empty-state">
          <p>{t("shop.catalog.noProducts")}</p>
          <button
            className="btn-primary"
            onClick={() => setSelectedCategory("all")}
          >
            {t("shop.catalog.showAllProducts")}
          </button>
        </div>
      )}
    </div>
  )
}
