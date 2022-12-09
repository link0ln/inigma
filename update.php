<?php

  function send_success(){
    print '{"status": "success", "message":"secret owned"}';
  }

  function send_failed($msg){
    print '{"status": "failed", "'.$msg.'"}';
  }

  function set_owner($fname){
    $uid = $_POST['uid'];
    $encrypted_message = $_POST['encrypted_message'];
    $iv = $_POST['iv'];
    $salt = $_POST['salt'];
  
    $json_text = file_get_contents("keys/$fname");
    if ($json_text == false){
      send_failed('No such secret');
      return 0;
    }
    $json_obj = json_decode($json_text);
    if ($json_obj->{'uid'} != ""){
      send_failed('Secret already owned');
      return 0;
    }
    $json_obj->{'encrypted'} = "true";
    $json_obj->{'encrypted_message'} = $encrypted_message;
    $json_obj->{'message'} = "";
    $json_obj->{'uid'} = $uid;
    $json_obj->{'iv'} = $iv;
    $json_obj->{'salt'} = $salt;
    $json_text = json_encode($json_obj);
    file_put_contents("keys/$fname", $json_text);
    send_success();
  }
  
  if ($_POST['view']){
    $fname = $_POST['view'];
    $result = preg_match("/^[a-zA-Z0-9]+$/",$fname);
    if ($result){
      set_owner($fname);
    }
  }

?>
