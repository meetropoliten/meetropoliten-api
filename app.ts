import http from 'http';
import crypto from 'crypto';

const hostname = '127.0.0.1';
const port = 3000;
const hosts: { [id: string]: { description: string, guestDescription: string } } = {};
const hostsRev: { [description: string]: string } = {};

async function getBody(request: http.IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
        const bodyParts: any[] = [];
        let body;
        request.on('data', (chunk) => {
            // console.log('data');
            bodyParts.push(chunk);
        }).on('end', () => {
            // console.log('end');
            body = Buffer.concat(bodyParts).toString();
            resolve(body);
        });
    });
}

function main() {
    const server = http.createServer(async (request, response) => {
        let urlStruct: URL | null = null;
        try {
            const fullUrl = 'http://host' + decodeURI(request.url || '');
            urlStruct = URL.parse(fullUrl);
            if (urlStruct === null) {
                console.error(request);
                throw new Error(`error parsing the url: ${fullUrl}`);
            }
            const url = urlStruct.pathname.split('/').filter(item => !!item).at(-1) || '';

            if (url === 'host' && request.method === 'POST') {
                const body: string = await getBody(request);
                const description: string = JSON.parse(body).description || '';
                let id: string = JSON.parse(body).id || (hostsRev[description] ? hostsRev[description] : '');

                if (description === '') {
                    throw new Error('empty description');
                }

                if (hosts[id]) {
                    delete hostsRev[hosts[id].description];
                    delete hosts[id];
                }
                if (hostsRev[description]) {
                    delete hosts[hostsRev[description]];
                    delete hostsRev[description];
                }

                if (id === '') {
                    do {
                        id = `${crypto.randomBytes(4).toString('hex')} ${crypto.randomBytes(4).toString('hex')}`;
                    } while (hosts[id] !== undefined);
                }

                hosts[id] = {
                    description: description,
                    guestDescription: ''
                };
                hostsRev[description] = id;

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end(`{"id": "${id}"}`);
            } else if (url === 'host' && request.method === 'GET') {
                const id: string = urlStruct.searchParams.get('id') || '';
                const host = hosts[id];
                if (!host) {
                    throw new Error('need host id');
                }
                if (host.guestDescription) {
                    throw new Error(`host ${id} already in a call`);
                }

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end(`{"id": "${id}", "description": "${host.description}"}`);
            } else if (url === 'guest' && request.method === 'POST') {
                const body: string = await getBody(request);
                const hostId: string = JSON.parse(body).hostId || '';
                const guestDescription: string = JSON.parse(body).guestDescription || '';

                if (hostId === '') {
                    throw new Error('empty hostId');
                }
                if (guestDescription === '') {
                    throw new Error('empty guestDescription');
                }
                const host = hosts[hostId];
                if (!host) {
                    throw new Error('host not found');
                }

                host.guestDescription = guestDescription;

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end('{}');
            } else if (url === 'guest' && request.method === 'GET') {
                const hostId: string = urlStruct.searchParams.get('hostId') || '';

                if (hostId === '') {
                    throw new Error('empty hostId');
                }

                const host = hosts[hostId];
                if (!host) {
                    throw new Error('host not found');
                }

                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                response.end(`{"guestDescription": "${host.guestDescription}"}`);

                if (host.guestDescription) {
                    delete hosts[hostId];
                }
            } else if (url === 'debug') {
                response.statusCode = 200;
                response.setHeader('Content-Type', 'application/json');
                // response.end(JSON.stringify(hosts));
                response.end('{}');
            } else {
                throw new Error('unhandled endpoint');
            }
        } catch (error) {
            console.log(urlStruct);
            console.log(request.headers);
            console.log(request.url);
            console.log(request.method);

            // const body = await getBody(request);
            // console.log(body);

            response.statusCode = 404;
            response.setHeader('Content-Type', 'application/json');
            response.end('{"error": "that\'s an error"}');
            console.error(error);
        }
    });

    server.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
}

main();