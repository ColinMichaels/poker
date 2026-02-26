<template>

  <game-component name="poker"></game-component>

</template>

<script>
    import Layout from "@/Shared/Layout";
    import GameComponent from "@/plugins/game/GameComponent";
    export default {
        name: "index",
        components:{
            GameComponent
        },
        metaInfo: {
            title: 'Dashboard',
        },
        layout: Layout
    }
</script>

<style scoped>

</style>
