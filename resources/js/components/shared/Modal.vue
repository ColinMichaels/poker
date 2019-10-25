<template>

    <div :id="name" class="overlay text-left z-50">
        <a href="#" class="cancel"></a>
        <div class="modal">

            <slot></slot>

            <footer class="flex mt-8">
                <slot name="footer" class="mt-4"></slot>
            </footer>
            <inline-svg name="code"></inline-svg>
            <a href="#" class="close">&times;</a>
        </div>
    </div>
</template>

<script>
    import InlineSvg from "./InlineSvg";
    export default {
        name: "Modal",
        components: {InlineSvg},
        props: ['name'],
        data(){
            return {
                name : 'modal'
            }
        }
    }
</script>

<style scoped>
    footer:empty{
        visibility: hidden;
    }
</style>

<style>

    .overlay {
        visibility: hidden;
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        left: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, .4);
        transition: opacity .6s;
        opacity: 0;
    }
    .overlay:target {
        visibility: visible;
        opacity: 1;
    }
    .modal {
        position: relative;
        width: 500px;
        max-width: 80%;
        background: white;
        border-radius: 4px;
        padding: 2.5em;
        box-shadow: 0 5px 11px rgba(36, 37, 38, 0.2);
    }
    .modal .close {
        position: absolute;
        top: 15px;
        right: 15px;
        color: grey;
        text-decoration: none;
    }
    .overlay .cancel {
        position: absolute;
        width: 100%;
        height: 100%;
    }
</style>
