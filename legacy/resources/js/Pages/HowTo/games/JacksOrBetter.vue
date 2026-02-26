<template>
    <game-rules :name="name">
        <template v-slot:heading>
            <div>
                <h2 class="text-4xl font-black">Draw Jacks or Better:</h2>
                <p>The lowest hand wins the pot. The format is similar to seven-card stud high, except the high card (aces are low) is required to make the forced bet on the first round, and the low hand acts first on all subsequent rounds. Straights and flushes have no ranking, so the best possible hand is 5-4-3-2-A (a wheel). An open pair does not affect the betting limit.</p>
            </div>
        </template>
        <template v-slot:rounds>
            <div>

            </div>
        </template>
        <template v-slot:rules>
            <div>
                <strong>Rules of Jacks or Better</strong>
                <ul class="numbered">
                    <li>A pair of jacks or better is required to open the pot. If no player opens the pot, the button moves forward and each player must ante again, unless the limit of antes has been reached for that particular game. (Most games allow three consecutive deals before anteing stops.)</li>
                    <li>If the opener should show false openers before the draw, any other active player has the opportunity to declare the pot opened. However, any player who originally passed openers is not eligible to declare the pot open. The false opener has a dead hand and the opening bet stays in the pot. Any other bet placed in the pot by the opener can be withdrawn, provided the action before the draw is not completed. If no other player declares the pot open, all bets are returned except the opener's first bet. The first bet and antes remain in the pot, and all players who were involved in that hand are entitled to play the next hand after anteing again.</li>
                    <li>Any player who has legally declared the pot opened must prove openers in order to win the pot.</li>
                    <li>In all cases, the pot plays (even if the opener shows or declares a fouled hand) if there has been a raise, two or more players call the opening bet, or all action is completed before the draw.</li>
                    <li>Even if you are all in for just the ante (or part of the ante), you can declare the pot open if you have openers. If you are all in and falsely declare the pot open, you lose the ante money and cannot continue to play on any subsequent deals until a winner is determined. Even if you buy in again, you must wait until the pot has been legally opened and someone else has won it before you can resume play.</li>
                    <li>Once action has been completed before the draw, the opener cannot withdraw any bets, whether or not the hand contains openers.</li>
                    <li>An opener may be allowed to retrieve a discarded hand to prove openers, at management's discretion.</li>
                    <li>Any player can request that the opener retain the opening hand and show it after the winner of the pot has been determined.</li>
                    <li>You can split openers, but you must declare that you are splitting and place all discards under a chip to be exposed by the dealer after the completion of the hand. If you declare that you are splitting openers, but it is determined that you could not possibly have had openers when your final hand is compared with your discards, you lose the pot.</li>
                    <li>You are not splitting openers if you retain openers. If you begin with the ace, joker, king, queen of spades, and the ten of clubs, you are not splitting if you throw the ten of clubs away. You are breaking a straight to draw to a royal flush, and in doing so, you have retained openers (ace-joker for two aces).</li>
                    <li>After the draw, if you call the opener's bet and cannot beat openers, you do not get your bet back. (You have received information about opener's hand that is not free.)</li>
                </ul>
            </div>
        </template>
    </game-rules>
</template>

<script>
    import GameRules from "@/Pages/HowTo/GameRules";
    import Card from "@/components/Poker/Card";
    export default {
        name: "JacksOrBetter",
        components:{
            GameRules
        },
        data(){
            return{
                name : "JacksOrBetter"
            }
        }
    }
</script>
