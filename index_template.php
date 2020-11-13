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
