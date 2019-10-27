<template>
    <div :id="name" class="overlay text-left z-50">
        <a href="#" class="cancel"></a>
        <div class="modal flex">

            <slot></slot>

            <footer class="flex mt-8 flex-auto">
                <slot name="footer" class="mt-4"></slot>
            </footer>

            <a href="#" class="close">&times;</a>
        </div>
    </div>
</template>

<script>
    export default {
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
