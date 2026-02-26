<template>

    <div :id="name" class="overlay text-left z-50">
        <a href="#" class="cancel"></a>
        <div class="modal flex flex-col max-w-3xl">

            <slot></slot>

            <footer class="flex mt-8">
                <slot name="footer" class="mt-4"></slot>
            </footer>
            <a href="#" class="close text-3xl font-black">&times;</a>
        </div>
    </div>
</template>

<script>
    export default {
        name: "Modal",
        props: ['name'],
        data(){
            return {

            }
        }
    }
</script>

<style scoped>
    footer:empty{
        visibility: hidden;
    }
</style>
