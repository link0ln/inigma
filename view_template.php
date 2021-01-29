<html>
<head>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
<script type="text/javascript" src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
<script type="text/javascript" src='https://<?php print $domain; ?>/functions.js'></script>
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

  $('#decrypt').on('click',function(){
    encrypted_message_b64 = json_data['encrypted_message'];
    iv_b64                = json_data['iv'];
    salt_b64              = json_data['salt'];

    encrypted_message = base64ToArrayBuffer(encrypted_message_b64);
    iv                = base64ToArrayBuffer(iv_b64);
    salt              = base64ToArrayBuffer(salt_b64);

    decrypted = decrypt(encrypted_message, salt, iv);

    decrypted.then( function(decrypted_message_array_buffer){
      decrypted_message = array_buffer2str(decrypted_message_array_buffer); 
      $("#secret").text(decrypted_message);
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
