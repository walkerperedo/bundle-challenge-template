class BundleCard extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })

    // Component properties
    this.mainProductId = this.getAttribute('main-product-id')
    this.bundleProductHandle = this.getAttribute('bundle-product-handle')

    // Customization
    this.cardTitle = this.getAttribute('card-title') || 'Frequently Bought Together';
    this.buttonText = this.getAttribute('button-text') || 'Add Both & Save 10%';
    this.titleSize = this.getAttribute('title-size') || '1.2rem';

    this.bundleProductData = null
    this.selectedVariant = null
    this.swiper = null
    this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer')
  }

  /**
   * Fired when the component is added to the DOM.
   * Renders a skeleton loader and kicks off the data fetching process.
   */
  connectedCallback() {
    this.renderSkeleton()
    this.fetchBundleProduct()
  }

  /**
   * Fetches the bundle product data from Shopify's JSON API.
   * On success, it finds the first available variant and triggers a full render.
   * On failure, it displays an error message.
   */
  async fetchBundleProduct() {
    if (!this.bundleProductHandle) return
    try {
      const response = await fetch(`/products/${this.bundleProductHandle}.js`)
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)
      this.bundleProductData = await response.json()
      this._mediaIndex = new Map(this.bundleProductData.media.map((m, i) => [m.id, i]))

      // Find the first available variant to be the default selection
      this.selectedVariant = this.bundleProductData.variants.find((v) => v.available) || this.bundleProductData.variants[0]

      this.render()
    } catch (error) {
      console.error('Shopify Bundle Card: Failed to fetch product data.', error)
      this.shadowRoot.innerHTML = `<p class="error">Could not load bundle offer.</p>`
    }
  }

  /**
   * Main render function. Builds the component's HTML, CSS, and initializes event listeners and the slider.
   */
  render() {
    const media = this.bundleProductData.media?.length
      ? this.bundleProductData.media.map((m) => ({ src: m.src, alt: m.alt }))
      : (this.bundleProductData.images || []).map((src) => ({ src: src.replace(/^\/\//, 'https://'), alt: this.bundleProductData.title }))

    this.shadowRoot.innerHTML = `
    <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/swiper@12/swiper-bundle.min.css"
    />
      <style>
        /* Scoped styles for the component. Leverages CSS variables for theme consistency. */
        :host {
          display: block;
          margin-top: 2rem;
          padding: 1.5rem;
          border: 1px solid var(--color-border, #e0e0e0);
          border-radius: var(--border-radius-base, 8px);
          background-color: var(--color-background-secondary, #f9f9f9);
        }
        .bundle-header {
          font-size: ${this.titleSize};
          font-weight: 600;
          margin-bottom: 1rem;
          margin-top: 1rem;
        }
        .bundle-content { display: grid; grid-template-columns: 100px 1fr; gap: 1.5rem; }
        .slider-container { min-width: 0; } /* Fix for swiper flexbox bug */
        .swiper-slide img { width: 100%; height: 120px; display: block; object-fit: cover; }
        .details h4 { margin: 0 0 0.5rem; font-size: 1.1rem; }
        .price { font-size: 1rem; margin-bottom: 1rem; }
        .variant-selectors { display: flex; flex-direction: column; gap: 1rem; }
        .option-group { border: none; padding: 0; margin: 0; }
        .option-group legend { font-weight: 500; margin-bottom: 0.5rem; }
        .option-group select { width: 100%; padding: 0.5rem; }
        .swatch-list { display: flex; flex-wrap: wrap; gap: 0.5rem; }
        .color-swatch {
          width: 32px; height: 32px;
          border-radius: 50%;
          border: 2px solid var(--color-border, #ccc);
          background-color: var(--color, black);
          cursor: pointer;
          transition: transform 0.1s ease;
        }
        .color-swatch:hover { transform: scale(1.1); }
        .color-swatch[data-selected="true"] {
          border-color: var(--color-accent, #040404);
          box-shadow: 0 0 0 0px var(--color-accent, #040404);
        }
        .add-bundle-button {
          width: 100%;
          padding: 0.75rem;
          margin-top: 1.5rem;
          background-color: var(--color-button-primary, #1a1a1a);
          color: var(--color-button-primary-text, white);
          border: none;
          border-radius: var(--border-radius-base, 8px);
          font-weight: 600;
          cursor: pointer;
        }
        .add-bundle-button:disabled { opacity: 0.6; cursor: not-allowed; }
        .swiper-button-next, .swiper-button-prev {
          color: var(--color-accent, #040404);
          --swiper-navigation-size: 24px;
        }
        
      </style>

      <div class="bundle-wrapper">
        <h3 class="bundle-header">${this.cardTitle}</h3>
        <div class="bundle-content">
          <div class="slider-container">
            <div class="swiper">
                <div class="swiper-wrapper">
                    ${media
                      .map(
                        (img) => `
                    <div class="swiper-slide"><img src="${img.src}" alt="${img.alt || this.bundleProductData.title}" loading="lazy"></div>
                    `
                      )
                      .join('')}
                </div>
                <div class="swiper-button-prev"></div>
                <div class="swiper-button-next"></div>
            </div>
          </div>
          <div class="details">
            <h4>${this.bundleProductData.title}</h4>
            <p class="price"></p>
            <div class="variant-selectors">
              ${this.bundleProductData.options.map((option, index) => this.renderOptionSelector(option, index)).join('')}
            </div>
            <button class="add-bundle-button">${this.buttonText}</button>
          </div>
        </div>
      </div>
    `

    this.initSwiper()
    this.addEventListeners()
    this.updateUI()
  }

  /**
   * Renders a specific variant option selector (e.g., dropdown or color swatches).
   * @param {object} option - The product option object from Shopify.
   * @param {number} index - The index of the option (0 for 'option1', etc.).
   * @returns {string} HTML string for the selector.
   */
  renderOptionSelector(option, index) {
    const optionKey = `option${index + 1}`
    const selectedValue = this.selectedVariant[optionKey]

    if (option.name.toLowerCase() === 'color') {
      return `
        <fieldset class="option-group" data-option-index="${index}">
          <legend>${option.name}</legend>
          <div class="swatch-list">
            ${option.values
              .map(
                (value) => `
              <button class="color-swatch"
                      role="radio"
                      aria-checked="${value === selectedValue}"
                      tabindex="${value === selectedValue ? '0' : '-1'}"
                      data-option-value="${value}"
                      style="--color: ${value.toLowerCase()};"
                      aria-label="Select ${value}"
                      data-selected="${value === selectedValue}"
              ></button>
            `
              )
              .join('')}
          </div>
        </fieldset>
      `
    }

    return `
      <div class="option-group">
        <label for="option-${index}">${option.name}</label>
        <select id="option-${index}" data-option-index="${index}">
          ${option.values
            .map(
              (value) => `
            <option value="${value}" ${value === selectedValue ? 'selected' : ''}>${value}</option>
          `
            )
            .join('')}
        </select>
      </div>
    `
  }

  /**
   * Attaches all necessary event listeners to the component's elements.
   */
  addEventListeners() {
    this.shadowRoot.querySelectorAll('select, .color-swatch').forEach((el) => {
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'click', this.onVariantChange.bind(this))
    })
    this.shadowRoot.querySelector('.add-bundle-button').addEventListener('click', this.onAddToCart.bind(this))
  }

  /**
   * Handles changes in variant selection. Finds the matching variant and updates the UI.
   */
  onVariantChange(event) {
    const isSwatch = event.currentTarget.classList.contains('color-swatch')

    if (isSwatch) {
      const parent = event.currentTarget.closest('.option-group')
      parent.querySelectorAll('.color-swatch').forEach((swatch) => {
        swatch.dataset.selected = 'false'
        swatch.setAttribute('aria-checked', 'false')
        swatch.tabIndex = -1
      })
      event.currentTarget.dataset.selected = 'true'
      event.currentTarget.setAttribute('aria-checked', 'true')
      event.currentTarget.tabIndex = 0
    }

    const selectedOptions = this.getSelectedOptions()

    this.selectedVariant = this.bundleProductData.variants.find((variant) =>
      variant.options.every((option, index) => option === selectedOptions[index])
    )

    this.updateUI()
  }

  /**
   * The central UI update function. Called whenever the selected variant changes.
   * Updates price, button state, and syncs the slider image.
   */
  updateUI() {
    const priceEl = this.shadowRoot.querySelector('.price')
    const buttonEl = this.shadowRoot.querySelector('.add-bundle-button')

    if (!this.selectedVariant) {
      priceEl.textContent = 'Unavailable'
      buttonEl.textContent = 'Unavailable'
      buttonEl.disabled = true
      return
    }

    priceEl.textContent = this.formatMoney(this.selectedVariant.price)
    buttonEl.disabled = !this.selectedVariant.available
    buttonEl.textContent = this.selectedVariant.available ? this.buttonText : 'Sold Out'

    // Sync slider with the variant's featured image
    if (this.selectedVariant?.featured_media?.id && this.swiper && this._mediaIndex) {
      const i = this._mediaIndex.get(this.selectedVariant.featured_media.id)
      if (i > -1) this.swiper.slideTo(i)
    }
  }

  /**
   * Handles the "Add to Cart" button click.
   * Constructs the payload and sends it to the Shopify Cart API.
   */
  async onAddToCart() {
  }

  // --- UTILITY METHODS ---

  /**
   * Initializes the Swiper.js slider.
   */
  async initSwiper() {
    const root = this.shadowRoot
    const container = root.querySelector('.swiper')
    if (!container) return
    try {
      await ensureSwiper()
      const nextEl = root.querySelector('.swiper-button-next')
      const prevEl = root.querySelector('.swiper-button-prev')

      this.swiper = new Swiper(container, {
        // autoplay: {
        //   delay: 5000,
        // },
        slidesPerView: 1,
        spaceBetween: 10,
        navigation: { nextEl, prevEl },
      })
    } catch (error) {
      console.warn('BundleCard: Swiper unavailable, rendering static images.', error)
      root.querySelectorAll('.swiper-button-next,.swiper-button-prev').forEach((el) => el.remove())
    }
  }

  /**
   * Formats a price in cents into a currency string.
   * This is a basic implementation. For production, use the Shopify.formatMoney function
   * if available, or a more robust library to handle different currencies.
   * @param {number} priceInCents - The price in the smallest currency unit.
   * @returns {string} Formatted currency string (e.g., "$45.00").
   */
  formatMoney(priceInCents) {
    try {
      if (window.Shopify?.formatMoney) return Shopify.formatMoney(priceInCents, window.theme?.moneyFormat)
      const currency = window.Shopify?.currency?.active || 'USD'
      return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(priceInCents / 100)
    } catch {
      return `$${(priceInCents / 100).toFixed(2)}`
    }
  }

  /**
   * Reads the selected options from the DOM elements.
   * @returns {string[]} An array of selected option values.
   */
  getSelectedOptions() {
    const options = []
    this.shadowRoot.querySelectorAll('[data-option-index]').forEach((element) => {
      const index = parseInt(element.dataset.optionIndex, 10)
      if (element.tagName === 'SELECT') {
        options[index] = element.value
      } else if (element.tagName === 'FIELDSET') {
        // For swatches
        const selectedSwatch = element.querySelector('[data-selected="true"]')
        if (selectedSwatch) {
          options[index] = selectedSwatch.dataset.optionValue
        }
      }
    })
    return options
  }

  /**
   * Renders a simple skeleton loader while data is being fetched.
   */
  renderSkeleton() {
    this.shadowRoot.innerHTML = `
      <style>
        :host { display: block; margin-top: 2rem; }
        .skeleton { background-color: #e0e0e0; border-radius: 4px; }
        .skeleton-box { width: 100px; height: 100px; }
        .skeleton-line { height: 20px; margin-bottom: 10px; }
      </style>
      <div style="display: grid; grid-template-columns: 100px 1fr; gap: 1.5rem; align-items: center;">
        <div class="skeleton skeleton-box"></div>
        <div>
          <div class="skeleton skeleton-line" style="width: 80%;"></div>
          <div class="skeleton skeleton-line" style="width: 40%;"></div>
          <div class="skeleton skeleton-line" style="width: 100%; height: 40px; margin-top: 1rem;"></div>
        </div>
      </div>
    `
  }
}
customElements.define('bundle-card', BundleCard)
