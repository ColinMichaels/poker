<?php
namespace Poker;

class Deck
{
	const SUITS = ['diamonds', 'hearts', 'spades','clubs'];
	const VALUES = [1,2,3,4,5,6,7,8,9,10,11,12,13];
	const TOTAL_CARDS = 52;
	const SUIT_COUNT = 13;

	public $cards, $count;

	public function __construct() {
		$this->deal();
		$this->count = 0;
	}

	public function suits()
    {
        return count(self::SUITS );
    }

    public function deal(){

	     foreach(self::SUITS as $suit){
	     	for($card = 0; $card < self::SUIT_COUNT; $card++){
	     		   $this->cards[] = new Card($suit,$card +1);
	        }
	     }

	     return $this;

    }
    public function shuffle(){

    	 shuffle($this->cards);
    	 return $this;

    }

    public function hasCount()
    {
        return count($this->cards);
    }

    public function draw($num_of_cards){

		$hand =[];
		for($i = 0; $i< $num_of_cards; $i++){
			  $hand[] =  $this->cards[$this->count];
			  unset($this->cards[$this->count]);
			  $this->count += 1;
		}
		return $hand;
    }
}
