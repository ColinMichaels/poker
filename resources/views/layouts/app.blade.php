@include('sections.header')
    <div id="app">
        @include('nav.default')
        @yield('content')
        @include('sections.footer')
    </div>
<!-- Scripts -->
<script src="{{ mix('js/app.js') }}"></script>
</body>
</html>

