<?php

$default = '{"message":"No such hash!", "redirect_root":"true"}';

function get_timestamp(){
  $date = new DateTime();
  return $date->getTimestamp();
}

function get_data($fname, $net_uid){
  global $default;
  $json_text = file_get_contents("keys/$fname");
  if ($json_text == false){
    return $default;
  }
  $json_obj = json_decode($json_text);
  if ( ($json_obj->{'uid'} == $net_uid) and ($json_obj->{'ttl'} > get_timestamp()) ){
    return $json_text;
  }
  if ( ($json_obj->{'uid'} == "") and ($json_obj->{'ttl'} > get_timestamp()) ){
    return $json_text;
  }
  return $default;
}

if ($_POST['view']){
  $fname = $_POST['view'];
  $net_uid = $_POST['uid'];
  $result = preg_match("/^[a-zA-Z0-9]+$/",$fname);
  if ($result){
    print get_data($fname, $net_uid);
  }
}

?>
