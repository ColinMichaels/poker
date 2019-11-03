<template>
    <div>
        <hooper :settings="hooperSettings">
            <slide v-for="game in games"
                   v-bind:key="game.id"
                   v-bind:name="game.name"
                   >
                <button
                    class="text-gray-1000 font-bold bg-gray-300 py-2 px-4 rounded hover:bg-gray-500 mb-6 w-full"
                    @click="toggleGames(game)">
                    {{game.name}}
                </button>
            </slide>
        </hooper>
        <div v-for="game in games"
             :key="game.id"
        >
            <div v-show="game.visible">
                <component v-bind:is="game.component"></component>
            </div>
        </div>
    </div>
</template>

<script>
    import Layout from "@/Shared/Layout";
    import GameRules from "@/Pages/HowTo/GameRules";
    import { Hooper, Slide } from 'hooper';
    import 'hooper/dist/hooper.css';
    /**
     * Games
     */
    import TexasHoldem from "./games/TexasHoldem";
    import SevenCardStud from "./games/SevenCardStud";
    import SevenCardStudHighLow from "./games/SevenCardStudHighLow";
    import Omaha from "./games/Omaha";
    import Lowball from "./games/Lowball";
    import MississippiStud from "./games/MississippiStud";
    import Razz from "./games/Razz";
    import DrawHigh from "./games/DrawHigh";
    import JacksOrBetter from "./games/JacksOrBetter";

    export default {
        name: "HowTo",
        props: ['game'],
        metaInfo: {
            title: 'How to Play Poker'
        },
        methods: {
            toggleGames(game) {

                _.forEach(this.games, function (game) {

                    game.visible = false;

                });
                location.hash = game.name;
                game.visible = true;
            },
            getGameNamesArr(){
                 return this.games.map(function(game){
                     return game.name;
                 });
            }
        },
        data() {
            return {
                games: [
                    {
                        id: 1,
                        name: 'TexasHoldem',
                        component: TexasHoldem,
                        visible: true
                    },
                    {
                        id: 2,
                        name: "SevenCardStudHighLow",
                        component: SevenCardStudHighLow,
                        visible: false
                    },
                    {
                        id: 3,
                        name: "SevenCardStud",
                        component: SevenCardStud,
                        visible: false
                    },
                    {
                        id: 4,
                        name: "Omaha",
                        component: Omaha,
                        visible: false
                    },
                    {
                        id: 5,
                        name: "Lowball",
                        component: Lowball,
                        visible: false
                    },
                    {
                        id: 6,
                        name: "MississippiStud",
                        component: MississippiStud,
                        visible: false
                    },
                    {
                        id: 7,
                        name: "Razz",
                        component: Razz,
                        visible: false
                    },
                    {
                        id: 8,
                        name: "JacksOrBetter",
                        component: JacksOrBetter,
                        visible: false
                    },
                    {
                        id: 9,
                        name: "DrawHigh",
                        component: DrawHigh,
                        visible: false
                    }
                ],
                hooperSettings:{
                    itemsToShow: 3,
                    infiniteScroll : true,
                    autoPlay: true,
                    breakpoints:{
                        1200:{
                            itemsToShow:6,
                        },
                        1000:{
                            itemsToShow: 4,
                        }
                    }
                }
            }
        },
        components: {
            Hooper,Slide,
            GameRules,
            TexasHoldem,
            SevenCardStudHighLow,
            SevenCardStud,
            Omaha,
            Lowball,
            MississippiStud,
            Razz
        },
        layout: Layout,
        mounted(){
            if(location.hash){
                const gameIndex = this.getGameNamesArr().findIndex(function(game){
                   return location.hash.substring(1) === game;
               });
               this.toggleGames(this.games[gameIndex]);
            }
        }
    }
</script>
