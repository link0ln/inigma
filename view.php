<?php

$default = '{"message":"No such hash!", "redirect_root":"true"}';

if ($_POST['view']){
  $fname = $_POST['view'];
  $result = preg_match("/^[a-zA-Z0-9]+$/",$fname);
  if ($result){
    if (file_exists("keys/$fname")) {
      $fp = fopen("keys/$fname","r") or print "";
      if ($fp){
        $text = fread($fp, filesize("keys/$fname"));
        fclose($fp);
        unlink("keys/$fname");
        print $text;
      }
    }else{
      print $default;
    }
  }
}
?>
