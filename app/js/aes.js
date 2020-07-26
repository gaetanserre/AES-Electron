const fs = require('fs');
const CryptoJS = require('crypto-js');
const Crypto = require('crypto');
const { Buffer } = require('buffer');

async function cipher_file(passphrase, origin, dest, mode, bufferSize, msg){
    var iv = null;
    var salt = null;
    var hash_file = null;

    var key = null;   
    var position_origin = null;
    var position_dest = null;

    fs.open(origin, 'r', function(status, fd_origin) {
        if (mode == 'dec'){
            iv = Buffer.alloc(16);
            salt = Buffer.alloc(16);
            hash_file = Buffer.alloc(64);

            fs.readSync(fd_origin, iv, 0, iv.length, 0);
            fs.readSync(fd_origin, salt, 0, salt.length, iv.length);
            fs.readSync(fd_origin, hash_file, 0, hash_file.length, iv.length + salt.length);

            if (hash_file.toString('hex') != CryptoJS.SHA3(passphrase + salt).toString()){
                alert("Wrong password");
                return false;
            }

            key = Crypto.scryptSync(passphrase, salt, 32);
                
            position_origin = iv.length + salt.length + hash_file.length;
            position_dest = 0;
            iv = CryptoJS.lib.WordArray.create(iv);
        }

        fs.open(dest, 'w', function(status, fd_dest){
            try {
                var stats = fs.statSync(origin);
            } catch {
            }

            var fileSizeInBytes = stats["size"];

            if (mode == 'enc'){
                salt = Crypto.randomBytes(16);
                iv = Crypto.randomBytes(16);
                hash = Buffer.from(CryptoJS.SHA3(passphrase + salt).toString(), 'hex');

                fs.write(fd_dest, iv, 0, iv.length, 0, function(err) {
                    if (err) throw 'error writing file: ' + err;
                });

                fs.write(fd_dest, salt, 0, salt.length, iv.length, function(err) {
                    if (err) throw 'error writing file: ' + err;
                });

                fs.write(fd_dest, hash, 0, hash.length, iv.length + salt.length, function(err) {
                    if (err) throw 'error writing file: ' + err;
                });

                key = Crypto.scryptSync(passphrase, salt, 32);
                position_origin = 0;
                position_dest = iv.length + salt.length + hash.length;
                iv = CryptoJS.lib.WordArray.create(iv);
            }

            while (position_origin < fileSizeInBytes){
                var size = Math.min(bufferSize, fileSizeInBytes - position_origin)
                let buffer = Buffer.alloc(size);
                fs.readSync(fd_origin, buffer, 0, size, position_origin);
                if (mode == 'enc'){
                    var enc = CryptoJS.AES.encrypt(CryptoJS.lib.WordArray.create(buffer), 
                    CryptoJS.lib.WordArray.create(key), {
                        iv: iv,
                        mode: CryptoJS.mode.CBC,
                        padding: CryptoJS.pad.Pkcs7
                    });
                    out = Buffer.from(enc.ciphertext.toString(), 'hex')

                } else if (mode =='dec'){
                    var enc = CryptoJS.AES.decrypt({ciphertext: CryptoJS.lib.WordArray.create(buffer)},
                    CryptoJS.lib.WordArray.create(key), {
                        iv: iv,
                        mode: CryptoJS.mode.CBC,
                        padding: CryptoJS.pad.Pkcs7
                    });
                    out = Buffer.from(enc.toString(), 'hex')
                }
                fs.write(fd_dest, out, 0, out.length, position_dest, function(err) {
                    if (err) throw 'error writing file: ' + err;
                });
                position_origin += size;
                position_dest += out.length;
            }

            fs.unlinkSync(origin);
            alert(msg);
            return true;

        });
    });
}

async function encrypt(passphrase, plain_file_path){
    let encrypted_file_path = plain_file_path + '.aes';
    cipher_file(passphrase, plain_file_path, encrypted_file_path, 'enc', 65536, "Encrypting done.");
}

async function decrypt(passphrase, encrypted_file_path){
    let plain_file_path = encrypted_file_path.replace(/\.[^/.]+$/, "");
    cipher_file(passphrase, encrypted_file_path, plain_file_path, 'dec', 65552, "Decrypting done.");
}