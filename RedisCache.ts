const REDIS_URL = process.env.REDISTOGO_URL ||
    process.env.REDISCLOUD_URL ||
    process.env.REDISGREEN_URL ||
    process.env.REDIS_URL ||
    'redis://192.168.3.88:6379';

import * as url from 'url';
import * as Koa from 'koa';

const TTL = process.env.PAGE_TTL || 86400;
const connection = url.parse(REDIS_URL);
const redis = require('redis');
const client = redis.createClient(connection.port, connection.hostname);

connection.path = (connection.pathname || '/').slice(1);
const database = connection.path.length ? connection.path : '0';
client.select(database);
// Parse out password from the connection string
if (connection.auth) {
    client.auth(connection.auth.split(':')[1]);
}

// Catch all error handler. If redis breaks for any reason it will be reported here.

client.on('error', function (error: unknown) {
    console.warn('Redis Cache Error: ' + error);
});

client.on('ready', function () {

    console.log('Redis Cache Connected');
});

client.on('end', function () {
    console.warn(
        'Redis Cache Conncetion Closed. Will now bypass redis until it\'s back.'
    );
});

export class RedisCache {
    cache: any = client;

    async cacheContent(key: string, headers: {}, payload: Buffer) {
        const response = {
            content: JSON.stringify(payload),
            headers: headers
        };
        await this.cache.set(key, JSON.stringify(response), async (error: unknown, reply: unknown) => {
            // If library set to cache set an expiry on the key.
            if (!error && reply && TTL) {
                await this.cache.expire(key, TTL, function (error: unknown, didSetExpiry: unknown) {
                    if (!error && !didSetExpiry) {
                        console.warn('Could not set expiry for "' + key + '"');
                    }
                });
            }
        });
    }


    /**
     * Returns middleware function.
     */
    middleware() {
        const cacheContent = this.cacheContent.bind(this);
        return async function (
            this: RedisCache,
            ctx: Koa.Context,
            next: () => Promise<unknown>) {
            const key = ctx.url;
            const res = await new Promise((resolve) => {
                this.cache.get(key, async (error: unknown, result: string) => {
                    if (!error && result) {
                        const response = JSON.parse(result);
                        const headers = response.headers;
                        ctx.set(headers);
                        try {
                            let payload = JSON.parse(response.content);
                            if (payload && typeof (payload) === 'object' &&
                                payload.type === 'Buffer') {
                                payload = new Buffer(payload);
                            }
                            ctx.body = payload;
                            return resolve(response);
                        } catch (error) {
                            console.log(
                                'Erroring parsing cache contents, falling back to normal render');
                        }
                    } else {
                        return resolve({});
                    }
                });
            });
            // @ts-ignore
            if (res && res.content) {
                console.log('success');
                return;
            }
            await next();
            if (ctx.status === 200) {
                cacheContent(key, ctx.response.headers, ctx.body);
            }
        }.bind(this);
    }

}
