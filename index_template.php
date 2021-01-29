<html>
<head>
<title>Inigma</title>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
<script type="text/javascript" src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
<script type="text/javascript" src='https://<?php print $domain; ?>/functions.js'></script>
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
