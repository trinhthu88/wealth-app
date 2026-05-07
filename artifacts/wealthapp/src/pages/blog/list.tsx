import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import PublicNav from "@/components/PublicNav";
import { apiFetch } from "@/lib/api";
import { Calendar, Tag } from "lucide-react";

interface BlogPost { id: string; title: string; slug: string; excerpt: string | null; category: string | null; coverImageUrl: string | null; publishedAt: string | null; }

export default function BlogListPage() {
  const { data: posts = [], isLoading } = useQuery<BlogPost[]>({
    queryKey: ["blog"],
    queryFn: () => apiFetch<BlogPost[]>("/blog"),
  });

  return (
    <div className="min-h-screen bg-background">
      <PublicNav />
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-3">Financial Insights</h1>
          <p className="text-muted-foreground">Expert articles on wealth building, investing, and expat finance in Southeast Asia.</p>
        </div>
        {isLoading ? (
          <div className="grid md:grid-cols-3 gap-6">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="bg-card border border-card-border rounded-xl h-64 animate-pulse" />)}</div>
        ) : posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No articles published yet.</p>
            <p className="text-sm mt-2">Check back soon for financial insights.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-6">
            {posts.map(post => (
              <Link key={post.id} href={`/blog/${post.slug}`}>
                <a className="group bg-card border border-card-border rounded-xl overflow-hidden hover:shadow-md transition-shadow block">
                  {post.coverImageUrl ? (
                    <div className="h-44 bg-cover bg-center" style={{ backgroundImage: `url(${post.coverImageUrl})` }} />
                  ) : (
                    <div className="h-44 bg-gradient-to-br from-primary/20 to-accent flex items-center justify-center">
                      <span className="text-4xl">📈</span>
                    </div>
                  )}
                  <div className="p-5">
                    {post.category && (
                      <div className="flex items-center gap-1.5 text-xs text-primary font-medium mb-2">
                        <Tag className="h-3 w-3" />{post.category}
                      </div>
                    )}
                    <h3 className="font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">{post.title}</h3>
                    {post.excerpt && <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{post.excerpt}</p>}
                    {post.publishedAt && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                        <Calendar className="h-3 w-3" />
                        {new Date(post.publishedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                  </div>
                </a>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
