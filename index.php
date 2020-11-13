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

if (preg_match("/slack/", $_SERVER['HTTP_USER_AGENT'])){
  print "One time url service.";
  exit(0);
} 

if (preg_match("/TelegramBot/", $_SERVER['HTTP_USER_AGENT'])){
  print "One time url service.";
  exit(0);
}

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

function encrypt($fname, $mess, $pass) {
  $aes256Key = hash("SHA256", $pass, true);
  srand((double) microtime() * 1000000);
  $enc_data['iv'] = mcrypt_create_iv(mcrypt_get_iv_size(MCRYPT_RIJNDAEL_256, MCRYPT_MODE_CBC), MCRYPT_RAND);
  $enc_data['enc_string'] = rtrim(base64_encode(mcrypt_encrypt(MCRYPT_RIJNDAEL_256, $aes256Key, $mess, MCRYPT_MODE_CBC, $iv)), "\0\3");
  return $enc_data;
}

function decrypt($fname, $mess, $pass) {
  $aes256Key = hash("SHA256", $pass, true);
  
}

function no_such_hash(){
  print header("Refresh: 4; URL=https://$domain/");
  print "<html><head><meta http-equiv='content-type' content='text/html; charset=utf-8' /></head><body>";
  print "<center>Нет такого ХЕША, либо ХЕШ был уже открыт.</center>";
  print "</body></html>";
  exit(0);
}

function get_timestamp(){
  $date = new DateTime();
  return $date->getTimestamp();
}

if ($_POST['text']){
  $text = $_POST['text'];
  $multiopen = $_POST['multiopen'];
  $pass = $_POST['password'];
  $alive_timestamp = $_POST['ttl']*24*60*60+get_timestamp();
  $fname = getRandomString(40);
  $fp = fopen("keys/$fname", "w");
  $json_data = array();
  $json_data['multiopen']       = $multiopen;
  $json_data['alive_timestamp'] = $alive_timestamp;
  $json_data['uid']             = get_uid();
  $json_data['encrypted']       = false;
  if ($pass != ""){
    $enc_data = encrypt($fname, $text, $pass);
    $json_data['encrypted_text'] = $enc_data['enc_string'];
    $json_data['iv']             = $enc_data['iv'];
    $json_data['encrypted']      = true;
  }

  fwrite($fp, json_encode($json_data));
  fclose($fp);
  print "<center>https://$domain/?view=".$fname."</center>";
  exit(0);
}

if ($_GET['view']){
  $fname = $_GET['view'];
  $result = preg_match("/^[a-zA-Z0-9]+$/",$fname);
  if ($result){
    if (file_exists("keys/$fname")) {
      $fp = fopen("keys/$fname","r") or print "";
      if ($fp){
        $text = fread($fp, filesize("keys/$fname"));
        fclose($fp);
        `rm "keys/$fname"`;
        print "<html><head><meta http-equiv='content-type' content='text/html; charset=utf-8' /></head><body>";
        print $text;
        print "</body></html>";
        exit(0);
      }
    }
    no_such_hash();
  }
}
?>

<html>
<head>
<title>Inigma</title>
<meta http-equiv='content-type' content='text/html; charset=utf-8' />
</head>
<body>
  <center>
    <form action="/" method=POST>
      <p>
      Text:<br><textarea cols=140 rows=10 name="text"></textarea></p>
      <p><input type=submit></p>
      <p><input type="checkbox" name="multiopen" value="Multiopen link" /> <font color=grey>Link can be opened only by one client MANY TIMES.</font></p>
      <p>Password:<br><input type="password" name="open_pwd" /><br><font color=grey>Second factor, for best security. Leave empty to disable.</font></p>
      <p>TTL(in days):<br><input type="text" name="ttl" value="10" /><br><font color=grey>Time to link live in days. Zero (0) to store permanently.</font></p>
    </form>
<br />
</center>
</body>
</html>
