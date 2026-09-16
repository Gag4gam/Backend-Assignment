"use strict";
// File generated from our OpenAPI spec by Castiron. See CONTRIBUTING.md for details.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SidebandEmitter = exports.WebSocketError = void 0;
exports.buildURL = buildURL;
const EventEmitter_1 = require("../../../core/EventEmitter.js");
const error_1 = require("../../../core/error.js");
const path_1 = require("../../../internal/utils/path.js");
class WebSocketError extends error_1.OpenAIError {
    constructor(message, event) {
        super(message);
        this.error = event ?? undefined;
    }
}
exports.WebSocketError = WebSocketError;
class SidebandEmitter extends EventEmitter_1.EventEmitter {
    _onError(event, message, cause) {
        message = message ?? safeJSONStringify(event) ?? 'unknown error';
        if (!this._hasListener('error')) {
            const error = new WebSocketError(message +
                `\n\nTo resolve these unhandled rejection errors you should bind an \`error\` callback, e.g. \`ws.on('error', (error) => ...)\` `, event);
            // @ts-ignore
            error.cause = cause;
            Promise.reject(error);
            return;
        }
        const error = new WebSocketError(message, event);
        // @ts-ignore
        error.cause = cause;
        this._emit('error', error);
    }
}
exports.SidebandEmitter = SidebandEmitter;
function buildURL(client, parameters) {
    const { session_id: path0, ...query } = parameters;
    const endpoint = (0, path_1.path) `/live/sessions/${path0}/attach`;
    const url = new URL(client.buildURL(endpoint, query, undefined));
    url.protocol = url.protocol === 'http:' || url.protocol === 'ws:' ? 'ws:' : 'wss:';
    return url;
}
function safeJSONStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=internal-base.js.map