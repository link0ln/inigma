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
      Text:<br><textarea cols=140 rows=10 name="text" id="text" ></textarea></p>
      <p><input type=submit id="submit2" /></p>
      <p><input type=button id="submit" /></p>
      <p><input type=hidden id="encrypted_text" name="encrypted_text" /></p>
      <p><input type=hidden id="encrypted" value="false" name="encrypted" /></p>
      <p><input type="checkbox" name="multiopen" value="true" /> <font color=grey>Link can be opened only by one client MANY TIMES.</font></p>
      <p>Password:<br><input type="password" name="password" id="password" /><br><font color=grey>Second factor, for best security. Leave empty to disable.</font></p>
      <p>TTL(in days):<br><input type="text" name="ttl" value="10" /><br><font color=grey>Time to link live in days. Zero (0) to store permanently.</font></p>
    </form>
<br />
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

  $('#submit').on('click', function(){
    if ($('#password').val() != ""){
      let message  = $('#text').val();
      let password = $('#password').val();

      salt = window.crypto.getRandomValues(new Uint8Array(16));
      iv = window.crypto.getRandomValues(new Uint8Array(16));
      encrypted_text = encrypt(message, salt, iv);

      console.log(encrypted_text);
      console.log(btoa(encrypted_text));
 
      $('#text').val("");
      $('#password').val("");
      $('#encrypted_text').val(JSON.stringify(encrypted_text));
      $('#encrypted').val("true");
      
    }
  });
</script>
</body>
</html>
