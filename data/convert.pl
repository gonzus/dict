use strict;
use warnings;

use Path::Tiny;
use Getopt::Long  qw/ GetOptions /;

my %OPTS = (
    cat   => '',
    part  => 'noun',
    guess => 1,
    help  => 0,
);
Getopt::Long::GetOptions(
    'guess'  => \$OPTS{guess},
    'cat=s'  => \$OPTS{cat},
    'part=s' => \$OPTS{part},
    'help'  => \$OPTS{help},
);

exit main();

sub process_file {
    my ($name) = @_;
    # printf("File [%s]\n", $name);

    my $count = 0;
    open my $fp, '<', $name or die "Could not open $name: $!";
    while( my $line = <$fp>)  {
        ++$count;
        chomp($line);
        # printf("%3d | [%s]\n", $count, $line);
        my @cols = split(' ', $line);

        my $cat = '';
        if ($OPTS{cat}) {
            $cat = $OPTS{cat};
        } elsif ($OPTS{guess}) {
            my $p = path($name);
            my $b = $p->basename;
            $cat = $b =~ s:^[-_0-9]+|\.[-_a-zA-Z0-9]+$::rg;
        }
        $cat = "-c $cat" if $cat;

        my $part = $OPTS{part};

        my $en = sprintf("%s:%s"   , 'en', $cols[2]);
        my $nl = sprintf("%s:%s+%s", 'nl', $cols[1], $cols[0]);
        my $es = sprintf("%s:%s+%s", 'es', $cols[4], $cols[3]);

        printf("add %s %s %-30.30s %-30.30s %s\n",
               $cat, $part, $en, $nl, $es);
    }
    close $fp;
}

sub show_help {
    print <<EOS;
Convert data from Google Sheet to dict commands
Usage: $0 [options]
    --cat <category>  category to use, empty for none (default is "$OPTS{cat}")
    --part <part>     part to use (default is "$OPTS{part}")
    --guess           guess category from file name (default is $OPTS{guess})
    --help            print this help
EOS
}

sub main {
    if ($OPTS{help}) {
        show_help();
        return 0;
    }

    foreach my $arg (@ARGV) {
        process_file($arg);
    }
    return 0;
}
