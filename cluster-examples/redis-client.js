/**
 * Real Redis Client for Deno
 * Uses the redis npm package via Deno's npm: import
 */

import { createClient } from "npm:redis@4.6.13";

export class RealRedisClient {
    constructor(url = 'redis://localhost:6379') {
        this.url = url;
        this.client = null;
        this.subscriber = null;
        this.publisher = null;
        this.connected = false;
        this.eventHandlers = new Map();
    }

    async connect() {
        try {
            // Create main client
            this.client = createClient({ url: this.url });
            
            // Create separate clients for pub/sub
            this.subscriber = this.client.duplicate();
            this.publisher = this.client.duplicate();

            // Connect all clients
            await this.client.connect();
            await this.subscriber.connect();
            await this.publisher.connect();

            this.connected = true;
            console.log(`✅ Connected to Redis at ${this.url}`);
            
            return this;
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error.message);
            throw error;
        }
    }

    async disconnect() {
        try {
            if (this.client) await this.client.disconnect();
            if (this.subscriber) await this.subscriber.disconnect();
            if (this.publisher) await this.publisher.disconnect();
            this.connected = false;
            console.log('✅ Disconnected from Redis');
        } catch (error) {
            console.error('❌ Error disconnecting from Redis:', error.message);
        }
    }

    // Hash operations
    async hset(key, ...args) {
        return await this.client.hSet(key, args);
    }

    async hgetall(key) {
        return await this.client.hGetAll(key);
    }

    async hdel(key, field) {
        return await this.client.hDel(key, field);
    }

    // Set operations  
    async sadd(key, ...values) {
        return await this.client.sAdd(key, values);
    }

    async srem(key, ...values) {
        return await this.client.sRem(key, values);
    }

    async smembers(key) {
        return await this.client.sMembers(key);
    }

    async scard(key) {
        return await this.client.sCard(key);
    }

    // Key operations
    async del(...keys) {
        return await this.client.del(keys);
    }

    async expire(key, seconds) {
        return await this.client.expire(key, seconds);
    }

    async exists(key) {
        return await this.client.exists(key);
    }

    // Pub/Sub operations
    async publish(channel, message) {
        return await this.publisher.publish(channel, message);
    }

    async subscribe(channel, callback) {
        console.log(`🔔 Subscribing to channel: ${channel}`);
        
        if (!this.eventHandlers.has(channel)) {
            this.eventHandlers.set(channel, new Set());
            
            // Subscribe to the channel
            await this.subscriber.subscribe(channel, (message) => {
                console.log(`📨 Received message on ${channel}:`, message.slice(0, 100) + '...');
                
                // Call all handlers for this channel
                const handlers = this.eventHandlers.get(channel);
                if (handlers) {
                    handlers.forEach(handler => {
                        try {
                            handler(channel, message);
                        } catch (error) {
                            console.error('Error in message handler:', error);
                        }
                    });
                }
            });
        }
        
        // Add the callback to handlers
        this.eventHandlers.get(channel).add(callback);
    }

    async unsubscribe(channel, callback) {
        const handlers = this.eventHandlers.get(channel);
        if (handlers) {
            handlers.delete(callback);
            
            // If no more handlers, unsubscribe from Redis
            if (handlers.size === 0) {
                await this.subscriber.unsubscribe(channel);
                this.eventHandlers.delete(channel);
                console.log(`🔕 Unsubscribed from channel: ${channel}`);
            }
        }
    }

    // String operations
    async get(key) {
        return await this.client.get(key);
    }

    async set(key, value, options = {}) {
        if (options.EX) {
            return await this.client.setEx(key, options.EX, value);
        }
        return await this.client.set(key, value);
    }

    // List operations
    async lpush(key, ...values) {
        return await this.client.lPush(key, values);
    }

    async rpush(key, ...values) {
        return await this.client.rPush(key, values);
    }

    async lpop(key) {
        return await this.client.lPop(key);
    }

    async rpop(key) {
        return await this.client.rPop(key);
    }

    async llen(key) {
        return await this.client.lLen(key);
    }

    // Utility methods
    async ping() {
        return await this.client.ping();
    }

    async flushall() {
        return await this.client.flushAll();
    }

    isConnected() {
        return this.connected && this.client?.isReady;
    }

    // Event emitter compatibility for the existing code
    on(event, handler) {
        if (event === 'message') {
            // This is handled by the subscribe method
            console.warn('Use subscribe() method for message events');
        }
    }

    off(event, handler) {
        if (event === 'message') {
            // This is handled by the unsubscribe method  
            console.warn('Use unsubscribe() method for message events');
        }
    }
}

export async function createRedisClient(url) {
    const client = new RealRedisClient(url);
    await client.connect();
    return client;
} 