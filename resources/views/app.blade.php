<!DOCTYPE html>
<html lang="{{ app()->getLocale() }}" class="h-full bg-grey-200">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <link href="{{ mix('css/app.css') }}" rel="stylesheet">
    <script src="{{ mix('js/app.js') }}" defer></script>
    @routes
</head>
<body class="h-screen antialiased leading-none">

@inertia

</body>
</html>

