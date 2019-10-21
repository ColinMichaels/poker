<template>
    <div>
        <div class="search-menu">
            <label for="search"><i class="fa fa-search"></i></label>
            <input id="search" type="text" name="search" value="Search"/>
        </div>
        <ul>
           <li v-for="item in items">
               {{ item }}
           </li>
        </ul>
    </div>

</template>

<script>
    export default {
        name: "SidebarMenu",
        props: ['items']
    }
</script>

<style scoped>

</style>
