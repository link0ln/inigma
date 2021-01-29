<html>
<head>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
<script src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
<script src='https://<?php print $domain; ?>/functions.js'></script>
</head>
<body>
<center>
<div id='info'>
<p>If this is one time open link, please save immediately, you cant get data again after been "get secret" pushed!!!</p>
<p><input type='button' id='get_secret' value='get secret'/></p>
</div>
<div id='secure' style='display: none'>
<p><input type='text' id='password'/></p>
<p><input type='button' id='decrypt' value='decrypt'/></p>
</div>
<p><div id='secret'></div></p>
</center>
<script language=javascript>
  view = $.urlParam('view');

  function base64ToArrayBuffer(b64) {
    var byteString = window.atob(b64);
    var byteArray = new Uint8Array(byteString.length);
    for(var i=0; i < byteString.length; i++) {
        byteArray[i] = byteString.charCodeAt(i);
    }

    return byteArray;
  }

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
  
  async function decrypt(plaintext, salt, iv) {
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
    return window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      enc_plaintext
    );
  }

  $('#decrypt').on('click',function(){
    encrypted_message_b64 = json_data['encrypted_message'];
    iv_b64                = json_data['iv'];
    salt_b64              = json_data['salt'];

    console.log(encrypted_message_b64);
    console.log(iv_b64);
    console.log(salt_b64);

    encrypted_message = base64ToArrayBuffer(encrypted_message_b64);
    iv                = base64ToArrayBuffer(iv_b64);
    salt              = base64ToArrayBuffer(salt_b64);

    console.log(encrypted_message);
    console.log(iv);
    console.log(salt);  
 
    decrypted = decrypt(encrypted_message, salt, iv);

    console.log(decrypted);

    decrypted.then( function(result){
      console.log(result);
      $("#secret").text(result);
      $('#secure').hide();
    });
    
  });
  $('#get_secret').on('click',function(){
    jQuery.post("/view.php", { view: view })
    .done(function(data) {
      json_data = jQuery.parseJSON(data);
      $("#secret").text(json_data['message']);
      $('#info').hide();
      if ( json_data['encrypted'] == 'true' ) {
        $('#secure').show();
      }
      if ( json_data['redirect_root'] == 'true' ) {
        setTimeout(function (){
          window.location.replace("/");
        }, 5000);
      }
    });
  });
</script>
</body>
</html>
