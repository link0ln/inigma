<?php

$default = '{"message":"No such hash!", "redirect_root":"true"}';

function get_timestamp(){
  $date = new DateTime();
  return $date->getTimestamp();
}

if ($_POST['view']){
  $fname = $_POST['view'];
  $result = preg_match("/^[a-zA-Z0-9]+$/",$fname);
  if ($result){
    if (file_exists("keys/$fname")) {
      $fp = fopen("keys/$fname","r") or print "";
      if ($fp){
        $json_text = fread($fp, filesize("keys/$fname"));
        fclose($fp);
        $json_obj = json_decode($json_text);
        if ($json_obj->{'ttl'} < get_timestamp()) {
          print $default;
        }else{
          print $json_text;
        }
        unlink("keys/$fname");
      }
    }else{
      print $default;
    }
  }
}
?>
