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
<link rel="stylesheet" href="https://<?php print $domain; ?>/main.css" crossorigin="anonymous">
</head>
<body>

<div class="modal fade" id="modal-secure-link" tabindex="-1" data-backdrop="static" data-keyboard="false" role="dialog" aria-labelledby="exampleModalLongTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLongTitle">Secure link(full link can be copied separately from key)</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="false">×</span>
        </button>
      </div>
      <div class="modal-body">
        <div class="container">
          <h6>First link already copied to clipboard</h6>
          <table class="table table-hover">
            <tbody>
              <tr class="table-light">
                <td>Full link:</td>
                <td id="secure-link"></td>
                <td><button id="copy-secure-link" type="button" class="btn btn-info btn-sm" style="float: right;">Copy</button></td>
           	</tr>
           	<tr class="table-light">
                <td>Only link:</td>
                <td id="secure-link-nokey">Column content</td>
                <td><button id="copy-secure-link-nokey" type="button" class="btn btn-info btn-sm" style="float: right;">Copy</button></td>
           	</tr>
           	<tr class="table-light">
                <td>Only key:</td>
                <td id="secure-link-keyonly">Column content</td>
                <td><button id="copy-secure-link-keyonly" type="button" class="btn btn-info btn-sm" style="float: right;">Copy</button></td>
           	</tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
        <!-- <button type="button" class="btn btn-primary">Button</button> -->
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="modal-show-credentials" tabindex="-1" data-backdrop="static" data-keyboard="false" role="dialog" aria-labelledby="exampleModalLongTitle" aria-hidden="true">
  <div class="modal-dialog modal-lg" role="document">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLongTitle">Local storage credentials</h5>
        <button type="button" class="close" data-dismiss="modal" aria-label="Close">
          <span aria-hidden="false">×</span>
        </button>
      </div>
      <div class="modal-body" id="form-credentials" >
        <div class="input-group mb-3">
          This is your atomaticly generated credentials, it can be edited, and submitted, if you want to open multilink credentials on different computers.
        </div>
        <div class="input-group mb-3">
          <input type="text" placeholder="uid" class="form-control" id="uid">
        </div>
        <div class="input-group mb-3">
          <input type="text" placeholder="password" class="form-control" id="pass">
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-primary" id="credentials-submit" data-dismiss="modal">Submit</button>
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Close</button>
      </div>
    </div>
  </div>
</div>


<div class="container-custom">
  <div class="container pt-3 my-3 border text-center container-custom">
    <div class="mb-3"> 
      <label for="message">Secure text</label>
      <textarea class="form-control" id="message" cols=140 rows=10 ></textarea>
    </div>
  
    <div class="mb-3"> 
      <button type="button" id="submit" class="btn btn-primary" data-toggle="modal" data-target="#modal-secure-link">Process</button>
    </div>
    <div class="container-sm border pt-3 my-3">
      <label for="ttl">TTL(in days):</label>
      <div class="input-group mb-3">
        <input type="text" class="form-control" id="ttl" value="10">
      </div>
      <small id="TtlHelp" class="form-text text-muted">Time to link live in days. Zero (0) to store permanently.</small>
    </div>
  
    <div class="container-sm border pt-3 my-3">
      <button type="button" id="show-credentials" class="btn btn-primary my-3" data-toggle="modal" data-target="#modal-show-credentials">Show your credentials</button> 
    </div>
  
    <div class="container-sm border pt-3 my-3 text-left">
      <ul class="list-unstyled">
        <li><h6>Changes from 10.12.2022, and other features:</h6></li>
        <li class="font-weight-bold">All data going throug server is now encrypted.</li>
        <li>All data will be encrypted with password, before sending to server.</li>
        <li>No need to set password, it will be generated automaticly.</li>
        <li>Password now is a part of link, so you can share it.</li>
        <li>Or you can send link without password, and share password separately.</li>
        <li>Once link is opened, it will be unavailable for opening from other customers.</li>
        <li>Once link is opened, it will reencrypted with customer password(always stored in local storage), and can be opened again from same customer many times.</li>
        <li>Once customer enter service, customer's password will be generated in background and stored in local storage.</li>
        <li>To use service on different computers/browsers, please sync uid and password by button "Show your credentials"</li>
      </ul>
    </div>

  </div>
</div>
<script language=javascript>
  $('#uid').val(get_uid());
  $('#pass').val(get_pass());
  $('#credentials-submit').on('click', function(){
    set_uid($('#uid').val());
    set_pass($('#pass').val());
  });
  $('#show-credentials').on('click', function(){
    $('#uid').val(get_uid());
    $('#pass').val(get_pass());
  });
  $('#copy-secure-link').on('click', function(){
    navigator.clipboard.writeText($('#secure-link').text());
  });
  $('#copy-secure-link-nokey').on('click', function(){
    navigator.clipboard.writeText($('#secure-link-nokey').text());
  });
  $('#copy-secure-link-keyonly').on('click', function(){
    navigator.clipboard.writeText($('#secure-link-keyonly').text());
  });
  $('#submit').on('click', function(){
    let message   = $('#message').val();
    let password  = genpassword(20);
    let multiopen = true;
    let ttl       = $('#ttl').val();

    salt = window.crypto.getRandomValues(new Uint8Array(16));
    iv = window.crypto.getRandomValues(new Uint8Array(16));
    encrypted_message = encrypt(message, salt, iv, password);

    iv_b64   = arrayBufferToBase64(iv);
    salt_b64 = arrayBufferToBase64(salt); 

    encrypted_message.then( function(result){
      encrypted_message_b64 = arrayBufferToBase64(result);
      $.post('/', { encrypted_message: encrypted_message_b64, encrypted: "true", iv: iv_b64, salt: salt_b64, ttl: ttl, multiopen: multiopen}).done(function(data) {
        json_data = JSON.parse(data);
        $('#secure-link').html(''.concat(json_data['url'], '?view=', json_data['view'], '&key=', password));
        $('#secure-link-nokey').html(''.concat(json_data['url'], '?view=', json_data['view']));
        $('#secure-link-keyonly').html(password);
        navigator.clipboard.writeText($('#secure-link').text());
      });
    });
  });
</script>
</body>
</html>
