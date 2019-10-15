# rendertron-redis-cache
rendertron redis cache
## Usage
### Building
Clone and install dependencies:

```shell
git clone https://github.com/GoogleChrome/rendertron.git
cd rendertron
npm install
```




### use rendertron-redis-cache
${rendertron_dir}/src/rendertron.ts

```javascript
const {RedisCache} = await import('./redis-cache');
this.app.use(new RedisCache().middleware());
```

```shell
npm run build
```
