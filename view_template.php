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
<p><div id='secret'></div></p>
</center>
<script language=javascript>
  view = $.urlParam('view');
  $('#get_secret').on('click',function(){
    jQuery.post("/view.php", { view: view })
    .done(function(data) {
      json_data = jQuery.parseJSON(data);
      $("#secret").text(json_data['text']);
      $('#info').hide();
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
