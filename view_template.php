<!DOCTYPE html>
<html>
<head>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<script type="text/javascript" src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
<script type="text/javascript" src='https://<?php print $domain; ?>/functions.js'></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-ho+j7jyWK8fNQe+A12Hb8AhRq26LrZ/JpcUGGOn+Y7RsweNrtN/tE3MoK7ZeZDyx" crossorigin="anonymous"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" integrity="sha384-TX8t27EcRE3e/ihU7zmQxVncDAy5uIKz4rEkgIXeMed4M0jlfIDPvg6uqKI2xXr2" crossorigin="anonymous">
<link rel="stylesheet" href="https://<?php print $domain; ?>/main.css" crossorigin="anonymous">
</head>
<body>
<div class="container-custom">
  <div class="container pt-3 my-3 border text-center">
    <div id='info'>
      <div class="alert alert-danger" role="alert">
        This is one-time link, which will be removed after openning, therefore it's better to save this data locally!!!
      </div>
      <p><button type="button" id='get_secret' class="btn btn-primary">Get secret</button></p>
    </div>
   
    <div class="alert alert-danger" role="alert" id="warn">
      Wrong password! Dont close this page until type right password, else link will be expired!!!
    </div> 
    <div id='secure' style='display: none'>

      <label for="pasword">Password:</label>
      <div class="input-group mb-3">
        <input type="password" class="form-control" id="password">
      </div>

      <div class="mb-3">
        <button type="button" id="decrypt" class="btn btn-primary">Decrypt</button>
      </div>
    </div>
    <p><pre><div id='secret'></div></pre></p>
    <p><div id='warn' style="color: red"></div></p>
  </div>
</div>
<script language=javascript>
  view = $.urlParam('view');

  $('#warn').hide();

  function show_self_secret(encrypted_message_b64, iv_b64, salt_b64){
    encrypted_message = base64ToArrayBuffer(encrypted_message_b64);
    iv                = base64ToArrayBuffer(iv_b64);
    salt              = base64ToArrayBuffer(salt_b64);
    password          = get_pass();   

    decrypted = decrypt(encrypted_message, salt, iv, password);

    decrypted.then( function(decrypted_message_array_buffer){
      decrypted_message = array_buffer2str(decrypted_message_array_buffer);
      $("#secret").text(decrypted_message);
    });
  }

  function send_update(message){
      salt = window.crypto.getRandomValues(new Uint8Array(16));
      iv = window.crypto.getRandomValues(new Uint8Array(16));
      password = get_pass();
      uid = get_uid();      
      encrypted_message = encrypt(message, salt, iv, password);
      iv_b64   = arrayBufferToBase64(iv);
      salt_b64 = arrayBufferToBase64(salt);

      encrypted_message.then( function(result){
        encrypted_message_b64 = arrayBufferToBase64(result);
        $.post('/update.php', { view: view, uid: uid, encrypted_message: encrypted_message_b64, iv: iv_b64, salt: salt_b64 }).done(function(data) {
          console.log("Update sent...");
          console.log(data);
        });
      });
  }

  $('#decrypt').on('click',function(){
    encrypted_message_b64 = json_data['encrypted_message'];
    iv_b64                = json_data['iv'];
    salt_b64              = json_data['salt'];
    password              = $("#password").val();

    encrypted_message = base64ToArrayBuffer(encrypted_message_b64);
    iv                = base64ToArrayBuffer(iv_b64);
    salt              = base64ToArrayBuffer(salt_b64);

    decrypted = decrypt(encrypted_message, salt, iv, password);

    decrypted.then( function(decrypted_message_array_buffer){
      decrypted_message = array_buffer2str(decrypted_message_array_buffer); 
      $("#secret").text(decrypted_message);
      if (json_data['own_by'] == undefined) {
        send_update(decrypted_message);
      }
      $('#warn').hide();
      $('#secure').hide();
    }, function(failed){
      $("#warn").show();
    });
  });
  $('#get_secret').on('click',function(){
    jQuery.post("/view.php", { view: view, uid: get_uid() })
    .done(function(data) {
      json_data = jQuery.parseJSON(data);
      $("#secret").text(json_data['message']);
      console.log(json_data['own_by']);
      if ( (json_data['own_by'] == undefined) && (json_data['encrypted'] == 'false') ){
        send_update(json_data['message']);
      }
      $('#info').hide();

      if ( ( json_data['encrypted'] == 'true' ) && (json_data['own_by'] == undefined) ){
        $('#secure').show();
      }

      if ( json_data['own_by'] == get_uid()){
        console.log("Owned secret!");
        encrypted_message_b64 = json_data['encrypted_message'];
        iv_b64                = json_data['iv'];
        salt_b64              = json_data['salt'];
        show_self_secret(encrypted_message_b64, iv_b64, salt_b64);
      }

      if ( json_data['redirect_root'] == 'true' ) {
        setTimeout(function (){
          window.location.replace("/");
        }, 50000);
      }
    });
  });
</script>
</body>
</html>
