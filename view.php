<?php

$default = '{"message":"No such hash!", "redirect_root":"true"}';

function get_timestamp(){
  $date = new DateTime();
  return $date->getTimestamp();
}

function check_key_owned($fname){
  $uid = $_POST['uid'];
  $json_text = file_get_contents("keys/$fname");
  if ($json_text == false){
    return 0;
  }
  $json_obj = json_decode($json_text);
  if ($json_obj->{'own_by'} == ""){
    return 0;
  }
  return 1;
}

function is_owner($fname){
  $uid = $_POST['uid'];
  $json_text = file_get_contents("keys/$fname");
  if ($json_text == false){
    return 0;
  }
  $json_obj = json_decode($json_text);
  if ($json_obj->{'own_by'} == $uid){
    return 1;
  }
  return 0;
}

function get_data($fname){
  global $default;
  $uid = $_POST['uid'];
  $json_text = file_get_contents("keys/$fname");
  if ($json_text == false){
    return $default;
  }
  if ( (check_key_owned($fname) != 0) and (is_owner($fname) != 1)){
    return $default;
  }
  #unlink("keys/$fname");
  $json_obj = json_decode($json_text);
  if ($json_obj->{'ttl'} < get_timestamp()) {
    return $default;
  }else{
    return $json_text;
  }
}


if ($_POST['view']){
  $fname = $_POST['view'];
  $result = preg_match("/^[a-zA-Z0-9]+$/",$fname);
  if ($result){
    print get_data($fname);
  }
}


?>
