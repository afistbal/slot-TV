<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />

  <meta property="og:type" content="website" />
  <meta property="og:locale" content="en_US" />
  <meta property="og:site_name" content="YogoShort" />
  <meta property="og:url" content="{{$php_url}}" />
  <meta property="og:title" content="{{$title}}" />
  <meta property="og:description" content="{{$introduction}}" />
  <meta property="og:image" content="{{$image}}" />
  <meta property="og:image:secure_url" content="{{$image}}" />
  <meta property="og:image:type" content="image/webp" />
  <meta property="og:image:width" content="360" />
  <meta property="og:image:height" content="640" />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="{{$title}}" />
  <meta name="twitter:description" content="{{$introduction}}" />
  <meta name="twitter:image" content="{{$image}}" />

  <meta name="description" content="{{$introduction}}" />
  <title>{{$title}}</title>
</head>
<body>
  <script>
    (function () {
      location.replace(location.origin + '/video/{{$id}}/{{$episode}}');
    })();
  </script>
</body>
</html>
