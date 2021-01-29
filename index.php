<?php
//header("Location: https://idone.su/inigma/index.php");
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

$domain = $_SERVER[HTTP_HOST]; #or maybe hardcoded doamin

if (!is_dir(getcwd()."/keys")) {
  mkdir(getcwd()."/keys",0700,true);
}

if (!is_dir(getcwd()."/iv")) {
  mkdir(getcwd()."/iv",0700,true);
}

`find keys/ -mtime +5 -exec rm -f {} \;`;

function get_uid() {
  $uid = $_COOKIE['uid'];
  if ($uid == "") {
    setcookie('uid',getRandomString(16));
  }
  return $uid;
}

function getRandomString($length = 20) {
  $validCharacters = "abcdefghijklmnopqrstuxyvwzABCDEFGHIJKLMNOPQRSTUXYVWZ0123456789";
  $validCharNumber = strlen($validCharacters);

  $result = "";

  for ($i = 0; $i < $length; $i++) {
      $index = mt_rand(0, $validCharNumber - 1);
      $result .= $validCharacters[$index];
  }
  return $result;
}

function get_timestamp(){
  $date = new DateTime();
  return $date->getTimestamp();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST'){
  $text = $_POST['text'];
  $multiopen = $_POST['multiopen'];
  $encrypted_text = $_POST['encrypted_text'];
  $encrypted = $_POST['encrypted'];
  $alive_timestamp = $_POST['ttl']*24*60*60+get_timestamp();
  $fname = getRandomString(40);
  $fp = fopen("keys/$fname", "w");
  $json_data = array();
  $json_data['multiopen']       = $multiopen;
  $json_data['alive_timestamp'] = $alive_timestamp;
  $json_data['uid']             = get_uid();
  $json_data['encrypted']       = $encrypted;
  $json_data['encrypted_text']  = $encrypted_text;
  $json_data['text']            = $text;

  fwrite($fp, json_encode($json_data));
  fclose($fp);
  print "<center>https://$domain/?view=".$fname."</center>";
  exit(0);
}

if ($_GET['view']){
  require('view_template.php');
  exit(0);
}

require('index_template.php');
?>
