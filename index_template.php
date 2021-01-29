<html>
<head>
<title>Inigma</title>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
<script src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
</head>
<body>
  <center>
    <form action="/" method=POST>
      <p>
      Text:<br><textarea cols=140 rows=10 name="message" id="message" ></textarea></p>
      <p><input type=button id="submit" value=submit /></p>
      <p><input type="checkbox" name="multiopen" value="true" id="multiopen" /> <font color=grey>Link can be opened only by one client MANY TIMES.</font></p>
      <p>Password:<br><input type="password" name="password" id="password" /><br><font color=grey>Second factor, for best security. Leave empty to disable.</font></p>
      <p>TTL(in days):<br><input type="text" name="ttl" value="10" id="ttl" /><br><font color=grey>Time to link live in days. Zero (0) to store permanently.</font></p>
    </form>
<br />
<div id="secure_link">
</div>
</center>
<script language=javascript>

  function getKeyMaterial() {
    let password = $('#password').val();
    let enc = new TextEncoder();
    return window.crypto.subtle.importKey(
      "raw",
      enc.encode(password),
      "PBKDF2",
      false,
      ["deriveBits", "deriveKey"]
    );
  }

  async function encrypt(plaintext, salt, iv) {
    let enc = new TextEncoder();
    enc_plaintext = enc.encode(plaintext);
    let keyMaterial = await getKeyMaterial();
    let key = await window.crypto.subtle.deriveKey(
      {
        "name": "PBKDF2",
        salt: salt,
        "iterations": 100000,
        "hash": "SHA-256"
      },
      keyMaterial,
      { "name": "AES-GCM", "length": 256},
      true,
      [ "encrypt", "decrypt" ]
    );
    return window.crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      enc_plaintext
    );
  }

  function arrayBufferToBase64(arrayBuffer) {
    var byteArray = new Uint8Array(arrayBuffer);
    var byteString = '';
    for(var i=0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
    }
    var b64 = window.btoa(byteString);

    return b64;
  }

  $('#submit').on('click', function(){
    let message   = $('#message').val();
    let password  = $('#password').val();
    let multiopen = $('#multiopen').val();
    let ttl       = $('#ttl').val();

    if ($('#password').val() != ""){
      salt = window.crypto.getRandomValues(new Uint8Array(16));
      iv = window.crypto.getRandomValues(new Uint8Array(16));
      encrypted_message = encrypt(message, salt, iv);

      iv_b64   = arrayBufferToBase64(iv);
      salt_b64 = arrayBufferToBase64(salt); 

      encrypted_message.then( function(result){
        encrypted_message_b64 = arrayBufferToBase64(result);


        console.log(result);
        console.log(iv);
        console.log(salt);

        console.log(encrypted_message_b64);
        console.log(iv_b64);
        console.log(salt_b64);

        
        $.post('/', { encrypted_message: encrypted_message_b64, encrypted: "true", iv: iv_b64, salt: salt_b64, ttl: ttl, multiopen: multiopen}).done(function(data) {
          $('#secure_link').html(data);
        });
      });
    } else {
      $.post('/', { message: message, encrypted: "false", ttl: ttl, multiopen: multiopen}).done(function(data) {
          $('#secure_link').html(data);
        });
    }
  });
</script>
</body>
</html>
