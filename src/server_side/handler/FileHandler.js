const AbstractHandler = require('./AbstractHandler'); 
const fs = require('fs');
const path = require('path');
const Response = require('../../client_side/model/ClientResponse');
const Logger = require('../../logger/Logger');

class FileHandler extends AbstractHandler {
    
    constructor(root) {
        super();
        this.root = root.replace(/\/+$/,'/');
        this.logger = Logger.getLogger('FileHandler');
    }
    
    static getMimeType(ext, _default) {
        const mimeType = {
            '.ico': 'image/x-icon',
            '.html': 'text/html',
            '.js': 'text/javascript',
            '.map': 'text/plain',
            '.json': 'application/json',
            '.css': 'text/css',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.wav': 'audio/wav',
            '.mp3': 'audio/mpeg',
            '.svg': 'image/svg+xml',
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.eot': 'appliaction/vnd.ms-fontobject',
            '.ttf': 'aplication/font-sfnt'
        };
        
        return mimeType[ext];
    }

    static getEncoding(ext, _default) {
        const utf = 'utf8';
        const binary = 'binary';
        const mimeType = {
            '.ico': binary,
            '.html': utf,
            '.js': utf,
            '.json': utf,
            '.css': utf,
            '.png': binary,
            '.jpg': binary,
            '.wav': binary,
            '.mp3': binary,
            '.svg': utf,
            '.pdf': binary,
            '.doc': binary,
            '.eot': binary,
            '.ttf': binary
        };

        return mimeType[ext];
    }
    
    handle(clientRequest, writeBack) {
        let pathname = this.getPath(clientRequest.path);
        const ext = path.parse(pathname).ext;
        const mimeType = FileHandler.getMimeType(ext);
        if (!mimeType) {
            return false;
        }
        
        this.logger.log(pathname);

        if (!fs.existsSync(pathname)) {
            return false;
        }
        
        if (fs.statSync(pathname).isDirectory()) {
            pathname += '/index.html';
            
            if (!fs.existsSync(pathname)) {
                return false;
            }
        }
        const encoding = FileHandler.getEncoding(ext);
        
        const data = fs.readFile(pathname, {}, function (error, data) {
            let response = new Response(200, data.toString(encoding), {'Content-type' : mimeType}, {}, null, clientRequest.uuid, encoding);
            writeBack(response);
        });
        
        return true;
    }
    getPath(path) {
        return this.root + path.replace(/^\/+|\/+$/g,'/');
    }
}

module.exports = FileHandler;