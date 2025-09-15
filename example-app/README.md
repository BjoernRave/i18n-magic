# i18n-magic Example App

This example application demonstrates the namespace feature of i18n-magic, which automatically generates separate JSON files for different namespaces based on file location patterns.

## Project Structure

```
example-app/
├── src/
│   ├── shared/           # Common components (→ common namespace)
│   ├── dashboard/        # Dashboard components (→ dashboard namespace)
│   ├── mobile/          # Mobile app components (→ mobile namespace)
│   ├── admin/           # Admin panel components (→ admin namespace)
│   ├── auth/            # Authentication components (→ auth namespace)
│   └── shop/            # E-commerce components (→ shop namespace)
├── locales/             # Generated translation files
│   ├── en/
│   │   ├── common.json
│   │   ├── dashboard.json
│   │   ├── mobile.json
│   │   ├── admin.json
│   │   ├── auth.json
│   │   └── shop.json
│   └── de/ (etc.)
├── i18n-magic.js       # Configuration file
└── package.json
```

## Namespace Configuration

The `i18n-magic.js` configuration file defines how files are mapped to namespaces:

- **Shared components** (`./src/shared/**`) → `common` namespace
- **Dashboard components** (`./src/dashboard/**`) → `dashboard` namespace  
- **Mobile components** (`./src/mobile/**`) → `mobile` namespace
- **Admin components** (`./src/admin/**`) → `admin` namespace
- **Auth components** (`./src/auth/**`) → `auth` namespace
- **Shop components** (`./src/shop/**`) → `shop` namespace

## Example Translation Keys

### Common Namespace
- `button.clickToAction`
- `button.loading`
- `validation.passwordTooShort`
- `validation.fieldRequired`

### Dashboard Namespace
- `dashboard.title`
- `dashboard.stats.totalUsers`
- `dashboard.userManagement.addUser`

### Mobile Namespace
- `mobile.home.greeting`
- `mobile.navigation.home`
- `mobile.home.actions.scanQR`

### Admin Namespace
- `admin.settings.title`
- `admin.roles.createRole`
- `admin.settings.general.maintenanceMode`

### Auth Namespace
- `auth.login.title`
- `auth.login.errors.emailRequired`
- `auth.passwordReset.sent.title`

### Shop Namespace
- `shop.catalog.title`
- `shop.cart.addToCart`
- `shop.cart.proceedToCheckout`

## Setup

1. **Create a `.env` file in the root directory** (i18n-magic/) with your API keys:
   ```bash
   # Copy the example
   cp ../env.example ../.env
   
   # Edit the .env file to add your API keys
   OPENAI_API_KEY=your_actual_api_key_here
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

## Usage

1. **Scan for translation keys:**
   ```bash
   npm run i18n:scan
   ```

2. **Clean unused translations:**
   ```bash
   npm run i18n:clean
   ```

3. **Sync translations across locales:**
   ```bash
   npm run i18n:sync
   ```

4. **Check for missing translations:**
   ```bash
   npm run i18n:check
   ```

5. **Debug namespace matching:**
   ```bash
   npm run i18n:debug
   ```

## How It Works

1. **File Scanning:** i18n-magic scans all files matching the glob patterns
2. **Namespace Assignment:** Each file is assigned to namespaces based on the pattern configuration
3. **Key Extraction:** Translation keys (`t('...')`) are extracted from each file
4. **Namespace Grouping:** Keys are grouped by their assigned namespaces
5. **File Generation:** Separate JSON files are created for each namespace and locale

## Benefits

- **Modular Translations:** Each feature/module has its own translation file
- **Better Organization:** Easier to manage translations for large applications
- **Team Collaboration:** Different teams can work on different namespaces
- **Selective Loading:** Load only the translations needed for specific parts of your app
- **Automatic Assignment:** No manual namespace specification needed in code

