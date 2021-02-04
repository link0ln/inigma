<!DOCTYPE html>
<html>
<head>
<title>Inigma</title>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
<script type="text/javascript" src='https://code.jquery.com/jquery-3.5.1.min.js'></script>
<script type="text/javascript" src='https://<?php print $domain; ?>/functions.js'></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/js/bootstrap.bundle.min.js" integrity="sha384-ho+j7jyWK8fNQe+A12Hb8AhRq26LrZ/JpcUGGOn+Y7RsweNrtN/tE3MoK7ZeZDyx" crossorigin="anonymous"></script>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@4.5.3/dist/css/bootstrap.min.css" integrity="sha384-TX8t27EcRE3e/ihU7zmQxVncDAy5uIKz4rEkgIXeMed4M0jlfIDPvg6uqKI2xXr2" crossorigin="anonymous">
</head>
<body>

<div class="modal fade" id="modal-secure-link" tabindex="-1" data-backdrop="static" data-keyboard="false" role="dialog" aria-labelledby="exampleModalLongTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLongTitle">Secure link (already copied to clipboard)</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="false">×</span>
        </button>
      </div>
      <div class="modal-body" id="secure-link" >
      </p></div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        <!-- <button type="button" class="btn btn-primary">Button</button> -->
      </div>
    </div>
  </div>
</div>

<div class="container pt-3 my-3 border text-center">
  <div class="mb-3"> 
    <label for="message">Secure text</label>
    <textarea class="form-control" id="message" cols=140 rows=10 ></textarea>
  </div>

  <div class="mb-3"> 
    <button type="button" id="submit" class="btn btn-primary" data-toggle="modal" data-target="#modal-secure-link">Process</button>
  </div>


  <div class="container-sm border pt-3 my-3">
  <div class="form-check">
    <input class="form-check-input" type="checkbox" value="" id="multiopen">
    <label class="form-check-label" for="multiopen">
      Link can be opened only by one client MANY TIMES.
    </label>
  </div>
  </div>

  <div class="container-sm border pt-3 my-3">
  <label for="pasword">Password:</label>
  <div class="input-group mb-3">
    <input type="password" class="form-control" id="password" aria-describedby="PasswordHelp">
  </div>
  <small id="PasswordHelp" class="form-text text-muted">Second factor, for best security. Leave empty to disable.</small>
  </div>

  <div class="container-sm border pt-3 my-3">
  <label for="ttl">TTL(in days):</label>
  <div class="input-group mb-3">
    <input type="text" class="form-control" id="ttl">
  </div>
  <small id="TtlHelp" class="form-text text-muted">Time to link live in days. Zero (0) to store permanently.</small>
  </div>


</div>

<script language=javascript>
  $('#uid').text(get_uid());
  $('#pass').text(get_pass());
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
          $('#secure-link').html(data);
          navigator.clipboard.writeText(data);
        });
      });
    } else {
      $.post('/', { message: message, encrypted: "false", ttl: ttl, multiopen: multiopen}).done(function(data) {
          $('#secure-link').html(data);
          navigator.clipboard.writeText(data);
        });
    }
  });
</script>
</body>
</html>
