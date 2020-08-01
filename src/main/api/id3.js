
// see https://id3.org/id3v2.3.0

export default class ID3 {

    #parseLength(buf) {
        return buf[0] * (1 << 21)
             + buf[1] * (1 << 14)
             + buf[2] * (1 <<  7)
             + buf[3] * (1      );
    }
    #toLengthBuffer(x) {
        return Buffer.from([
            (x >> 28) & 0x7f,
            (x >> 14) & 0x7f,
            (x >>  7) & 0x7f,
            (x      ) & 0x7f,
        ]);
    }
    #parseUInt32(buf) {
        return buf[0] * 0x01000000
             + buf[1] * 0x00010000
             + buf[2] * 0x00000100
             + buf[3] * 0x00000001;
    }
    #uint32toBuffer(x) {
        const buf = Buffer.alloc(4);
        buf.writeUInt32BE(x);
        return buf;
    }
    #parseTags(buf) {
        if (!buf.length) {
            return [];
        }
        const tagname = buf.slice(0, 4).toString('ascii');
        const length = this.#parseUInt32(buf.slice(4, 8));
        const flags = buf.slice(8, 10);
        const data = buf.slice(10, 10 + length);
        return [{
            tagname, length, flags, data
        }, ...this.#parseTags(buf.slice(10 + length))];
    }
    #tag2buffer(tag) {
        return Buffer.concat([
            Buffer.from(tag.tagname, 'ascii'),
            this.#uint32toBuffer(tag.length),
            this.flags,
            this.data,
        ]);
    }

    constructor(buf) {
        this.header = buf.slice(0, 6);
        this.length = this.#parseLength(buf.slice(6, 10));
        this.tags = this.#parseTags(buf.slice(10, 10 + this.length));
        this.content = buf.slice(10 + this.length);
    }

    #iso2buffer(text) {
        return Buffer.concat([
            Buffer.from(text, 'ascii'),
            Buffer.from([ 0x00 ]),
        ]);
    }
    #utf2buffer(text) {
        return Buffer.concat([
            // utf8 header
            Buffer.from([ 0xff, 0xfe ]),
            // content
            Buffer.from(text, 'utf16le'),
            // ending
            Buffer.from([ 0x00, 0x00 ]),
        ]);
    }

    #addTag(tagname, data) {
        this.tags.push({
            tagname,
            length: data.length,
            flags: Buffer.from([ 0x00, 0x00 ]),
            data
        });
    }

    #addTextTag(tagname, text) {
        this.#addTag(tagname, Buffer.concat([
            // encoding
            Buffer.from([ 0x01 ]),
            this.#utf2buffer(text),
        ]));
    }

    addTIT2Tag(text) {
        this.#addTextTag('TIT2', text);
    }
    addTCOMTag(text) {
        this.#addTextTag('TCOM', text);
    }
    addTALBTag(text) {
        this.#addTextTag('TALB', text);
    }

    addAPICTag(cover) {
        return this.#addTag('APIC', Buffer.concat([
            // text encoding
            Buffer.from([ 0x00 ]),
            // MIME type: image/jpeg
            this.#iso2buffer('image/jpeg'),
            // picture type: Cover (front)
            Buffer.from([ 0x03 ]),
            // description: nothing
            this.#iso2buffer(''),
            cover,
        ]));
    }

    toBuffer() {
        return Buffer.concat([
            this.header,
            this.#toLengthBuffer(this.tags.reduce((total, { length }) => {
                return total + length + 10;
            }, 0)),
            Buffer.concat(this.tags.map(this.#tag2buffer.bind(this))),
            this.content,
        ]);
    }
}