# Alshaya AEM sites
- H&M - Live Website:  https://ae.hm.com
- BBW - Live Website:  https://www.bathandbodyworks.ae/
- FOO - Live Website:  https://www.footlocker.ae/
- CHA - Live Website:  https://ae.charlottetilbury.com

## Environments
### H&M
- Preview: https://main--hm-qa-global--alshaya-axp.aem.page/
- Live: https://main--hm-qa-global--alshaya-axp.aem.live/

### BBW
- Preview: https://main--bbw-qa-global--alshaya-axp.aem.page/
- Live: https://main--bbw-qa-global--alshaya-axp.aem.live/

### FOO
- Preview: https://main--foo-qa-global--alshaya-axp.aem.page/
- Live: https://main--foo-qa-global--alshaya-axp.aem.live/

### CHA
- Preview: https://main--cha-qa-global--alshaya-axp.aem.page/
- Live: https://main--cha-qa-global--alshaya-axp.aem.live/

## Installation

```sh
npm i
```

## Theme Management

### Initiate new Brand Theme
Setup dev environment for a new brand theme
```
npm run theme:init
```

### Remove Brand Theme
Remove unwanted brand theme
```
npm run theme:remove
```

### Start Theme

Starts Gulp server to generate and serve merged CSS

```
npm run theme:start
```

## Environment Proxy
setup .env file to point to specific pages url

### H&M
```
AEM_OPEN=/en/
AEM_PORT=3000
AEM_PAGES_URL=https://main--hm-qa-global--alshaya-axp.aem.page
```

### BBW
```
AEM_OPEN=/en/
AEM_PORT=3000
AEM_PAGES_URL=https://main--bbw-qa-global--alshaya-axp.aem.page
```

## Linting

```sh
npm run lint
```

## Local development   

1. Install node and npm
2. Install the [AEM CLI](https://github.com/adobe/aem-cli): `npm install -g @adobe/aem-cli`
3. Install ```npm i```  on code repo
4. Setup `.env` file to point to specific pages url
5. Start Brand theme `npm run theme:start`
5. Start AEM Proxy: `aem up` (opens your browser at `http://localhost:3000`)
6. Open the `{repo}` directory in your favorite IDE and start coding :)
