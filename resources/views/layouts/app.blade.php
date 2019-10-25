@include('sections.header')
    <div id="app" data-component="{{ $component }}" data-props="{{ json_encode($props) }}">
        @include('nav.default')
        @yield('content')
        @include('sections.footer')
    </div>
<!-- Scripts -->
<script src="{{ mix('js/app.js') }}"></script>
</body>
</html>

