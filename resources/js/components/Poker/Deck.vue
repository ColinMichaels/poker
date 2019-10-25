<template>
    <div>
        <ul  class="w-1/2 flex flex-wrap">
           <li v-for="card in cards">
               <card :name="card"></card>
           </li>
        </ul>
    </div>
</template>

<script>
    import Card from "./Card";
    import { NAMES } from "./names";
    import { SUITS } from "./suits";
    const total_cards = 52;

    export default {
        name: "Deck",
        data(){
            return{
                cards: []
            }
        },
        components:{
            Card
        },
        methods:{
             build(){
                 let suit = Object.keys(SUITS);
                 let names = Object.keys(NAMES);
                 for(const suit of suit) {
                     for (const val of names) {
                         this.cards.push(val+suit);
                     }
                 }
            }
        },
        mounted(){
            this.build();
        }
    }
</script>

<style scoped>

</style>
