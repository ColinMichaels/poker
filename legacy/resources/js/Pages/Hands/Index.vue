<template>
	       <div class="pb-32">
               <hands></hands>
           </div>
</template>

<script>
    import Layout from "@/Shared/Layout";
    import Hands from "@/Pages/Hands/Hands";
    export default {
        name: "Index",
        metaInfo:{
           title : "Hands"

        },
        layout : Layout,
        components:{
            Hands
        }
    }
</script>

<style scoped>

</style>
