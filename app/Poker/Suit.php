<?php
namespace Poker;

class Suit
{
	const SYMBOLS = ['diamonds' => '&diamonds','hearts' => '&hearts', 'clubs' => '&clubs', 'spades' => '&spades'];
	const ICONS = ['hearts' =>'♥','diamonds'=>'♦','spades' =>'♠','clubs' =>'♣'];
    const SUITS = [ 'diamonds', 'hearts', 'spades', 'clubs' ];

	public $name, $symbol, $icon;

	public function __construct($suit = 'spades') {
		$this->name = $suit;
		$this->icon = self::ICONS[$this->name];
		$this->symbol = self::SYMBOLS[$this->name];
	}

	public static function get(){
	    return Suit::SUITS;
    }

}
